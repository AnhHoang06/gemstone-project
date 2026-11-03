import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn(), connections: [] }));
vi.mock('../../api/api', () => ({ default: { get: mocks.get }, API_ORIGIN: 'http://localhost:5132' }));
vi.mock('../../components/AnalyticsCharts', () => ({ default: ({ data }) => <pre data-testid="charts">{JSON.stringify({ trend: data.trend, breakdown: data.breakdown })}</pre> }));
vi.mock('@microsoft/signalr', () => ({ LogLevel: { None: 6 }, HubConnectionBuilder: class {
  withUrl() { return this; } withAutomaticReconnect() { return this; } configureLogging() { return this; }
  build() { const handlers = {}; const connection = { handlers, on: (name, fn) => { handlers[name] = fn; },
    onreconnected: fn => { handlers.reconnected = fn; }, onreconnecting: fn => { handlers.reconnecting = fn; }, onclose: fn => { handlers.close = fn; },
    start: vi.fn(async () => {}), stop: vi.fn(async () => {}) }; mocks.connections.push(connection); return connection; }
} }));
import AdminDashboard from './AdminDashboard';
import CommerceProvider from '../../commerce/CommerceProvider';
import { saveSession } from '../../auth/session';
let revenue;
const analyticsCalls = () => mocks.get.mock.calls.filter(([path]) => path.startsWith('/dashboard/analytics?'));
const response = () => ({ summary: { revenue, completedOrders: revenue ? 1 : 0, unitsSold: revenue ? 2 : 0, averageOrderValue: revenue },
  trend: [{ revenue, orders: revenue ? 1 : 0, unitsSold: revenue ? 2 : 0 }], breakdown: [{ id: 1, revenue }] });
beforeEach(() => {
  vi.clearAllMocks(); mocks.connections.length = 0; revenue = 0;
  saveSession({ token: 'A', role: 'Admin', fullName: 'Admin' });
  mocks.get.mockImplementation(async path => ({ data: path === '/cart' ? { items: [] } : path.includes('/options') ? {
    categories: [{ id: 1, name: 'Ruby', isActive: true }], products: [{ id: 11, name: 'Ruby Oval', categoryId: 1, isActive: true }],
  } : response() }));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); });
async function mount() { const view = render(<CommerceProvider><AdminDashboard /></CommerceProvider>); await screen.findByTestId('charts'); return view; }
it('refetches KPI/trend/breakdown after the real provider receives OrderStatusChanged', async () => {
  await mount();
  const before = analyticsCalls().length;
  revenue = 2000000;
  act(() => mocks.connections[0].handlers.OrderStatusChanged({ orderId: 52 }));
  await waitFor(() => expect(analyticsCalls().length).toBeGreaterThan(before));
  await waitFor(() => expect(JSON.parse(screen.getByTestId('charts').textContent).trend[0].revenue).toBe(2000000));
  expect(JSON.parse(screen.getByTestId('charts').textContent).breakdown[0].revenue).toBe(2000000);
  expect(screen.getAllByText(/2.000.000/).length).toBeGreaterThan(0);
});

it('manual refresh retrieves changed server data even without an event', async () => {
  await mount(); revenue = 2000000;
  expect(JSON.parse(screen.getByTestId('charts').textContent).trend[0].revenue).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
  await waitFor(() => expect(JSON.parse(screen.getByTestId('charts').textContent).trend[0].revenue).toBe(2000000));
});
it('coalesces event bursts, preserves filters and keeps charts visible while refreshing', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('Danh mục'), {target:{value:'1'}});
  fireEvent.change(screen.getByLabelText('Sản phẩm'), {target:{value:'11'}});
  await screen.findByTestId('charts');
  const before=analyticsCalls().length;
  let finish;
  mocks.get.mockImplementation(path => path.startsWith('/dashboard/analytics?') ? new Promise(resolve=>{finish=resolve;}) : Promise.resolve({data:{items:[]}}));
  vi.useFakeTimers();
  await act(async () => { for(let i=0;i<5;i++) mocks.connections[0].handlers.OrderStatusChanged({orderId:52}); });
  await act(async () => vi.advanceTimersByTimeAsync(199));
  expect(analyticsCalls()).toHaveLength(before);
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(analyticsCalls()).toHaveLength(before+1);
  expect(analyticsCalls().at(-1)[0]).toBe('/dashboard/analytics?range=30d&refresh=0&categoryId=1&productId=11');
  expect(screen.queryByText('Đang tải báo cáo bán hàng…')).toBeNull();
  expect(screen.getByTestId('charts')).toBeTruthy();
  revenue=2000000; await act(async()=>finish({data:response()}));
  expect(screen.getByLabelText('Danh mục').value).toBe('1'); expect(screen.getByLabelText('Sản phẩm').value).toBe('11');
});
it('retains data on background failure and manual refresh recovers', async () => {
  await mount();
  const original=mocks.get.getMockImplementation();
  mocks.get.mockImplementation(path => path.startsWith('/dashboard/analytics?') ? Promise.reject(new Error('offline')) : original(path));
  act(()=>mocks.connections[0].handlers.OrderStatusChanged({orderId:52}));
  await screen.findByRole('alert');
  expect(screen.getByTestId('charts')).toBeTruthy();
  mocks.get.mockImplementation(original); revenue=2000000;
  fireEvent.click(screen.getByRole('button',{name:'Thử lại'}));
  await waitFor(()=>expect(JSON.parse(screen.getByTestId('charts').textContent).trend[0].revenue).toBe(2000000));
  expect(screen.queryByRole('alert')).toBeNull();
});
it('reconnect refetches; unrelated connection state and stale callbacks after unmount do not', async () => {
  const view=await mount(); const connection=mocks.connections[0];
  vi.useFakeTimers(); const before=analyticsCalls().length;
  await act(async()=>{connection.handlers.reconnecting(); await vi.advanceTimersByTimeAsync(250);});
  expect(analyticsCalls()).toHaveLength(before);
  await act(async()=>connection.handlers.reconnected());
  await act(async()=>vi.advanceTimersByTimeAsync(250));
  expect(analyticsCalls()).toHaveLength(before+1);
  act(()=>connection.handlers.OrderStatusChanged({orderId:52}));
  view.unmount();
  await act(async()=>{connection.handlers.OrderStatusChanged({orderId:52}); await vi.advanceTimersByTimeAsync(250);});
  expect(connection.stop).toHaveBeenCalledTimes(1);
  expect(analyticsCalls()).toHaveLength(before+1);
});
it('ignores a stale background response after filters change', async () => {
  await mount(); const original=mocks.get.getMockImplementation(); let finish;
  mocks.get.mockImplementation(path => path.startsWith('/dashboard/analytics?range=30d') ? new Promise(resolve=>{finish=resolve;}) : original(path));
  act(()=>mocks.connections[0].handlers.OrderStatusChanged({orderId:52}));
  await waitFor(()=>expect(finish).toBeTypeOf('function'));
  fireEvent.change(screen.getByLabelText('Thời gian'),{target:{value:'7d'}});
  await screen.findByTestId('charts');
  revenue=999; await act(async()=>finish({data:response()}));
  expect(JSON.parse(screen.getByTestId('charts').textContent).trend[0].revenue).toBe(0);
});

it('dashboard unmount cancels queued work without creating another connection', async () => {
  const view=await mount(); const connection=mocks.connections[0]; const before=analyticsCalls().length;
  act(()=>connection.handlers.OrderStatusChanged({orderId:52}));
  view.rerender(<CommerceProvider><p>Another page</p></CommerceProvider>);
  vi.useFakeTimers();
  await act(async()=>{connection.handlers.NewOrder({orderId:53}); await vi.advanceTimersByTimeAsync(500);});
  expect(analyticsCalls()).toHaveLength(before); expect(mocks.connections).toHaveLength(1);
});
