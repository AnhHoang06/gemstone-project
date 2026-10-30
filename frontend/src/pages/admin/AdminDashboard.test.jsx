import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { api, charts, destroy } = vi.hoisted(() => ({ api: { get: vi.fn() }, charts: [], destroy: vi.fn() }));
vi.mock('../../api/api', () => ({ default: api }));
vi.mock('chart.js', () => ({
  Chart: class { static register() {} constructor(_canvas, config) { charts.push(config); } destroy() { destroy(); } },
  LineController: {}, DoughnutController: {}, LineElement: {}, PointElement: {}, ArcElement: {}, CategoryScale: {}, LinearScale: {}, Tooltip: {},
}));
import AdminDashboard from './AdminDashboard';
const options = {
  categories: [{ id: 1, name: 'Ruby', isActive: true }, { id: 2, name: 'Sapphire', isActive: true }, { id: 3, name: 'Star', parentId: 1, isActive: false }],
  products: [{ id: 11, name: 'Ruby Star', categoryId: 3, parentId: 1, isActive: false }, { id: 12, name: 'Ruby Oval', categoryId: 1, isActive: true }, { id: 21, name: 'Sapphire Blue', categoryId: 2, isActive: true }],
};
const row = (id, name, type, revenue = 2000000) => ({ id, name, type, revenue, unitsSold: 2 });
function response(path) {
  const q = new URL(path, 'http://local').searchParams, categoryId = Number(q.get('categoryId')) || null, productId = Number(q.get('productId')) || null;
  return { filters: { start: '2001-01-01', end: '2001-01-07', categoryId, productId, grouping: 'daily' },
    summary: { revenue: 2000000, unitsSold: 2, completedOrders: 1, averageOrderValue: 2000000 },
    trend: [{ startDate: '2001-01-01', endDate: '2001-01-01', revenue: 2000000, unitsSold: 2, orders: 1 }],
    breakdown: categoryId ? [row(11, 'Ruby Star', 'product'), row(12, 'Ruby Oval', 'product', 1000000)] : [row(1, 'Ruby', 'category'), row(2, 'Sapphire', 'category')] };
}
const mockSuccess = path => Promise.resolve({ data: path.includes('/options') ? options : response(path) });
beforeEach(() => { vi.clearAllMocks(); charts.length = 0; api.get.mockImplementation(mockSuccess); });
afterEach(cleanup);
const ready = () => screen.findByRole('heading', { name: 'Cơ cấu bán hàng' });

it('initial load uses the API, 30 days and explicit revenue rule', async () => {
  render(<AdminDashboard />); await ready();
  expect(api.get).toHaveBeenCalledWith('/dashboard/analytics?range=30d&refresh=0');
  expect(screen.getByText(/Completed \+ Paid/)).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Hoạt động bán hàng: Doanh thu' })).toBeTruthy();
});
it('changes preset and custom date range', async () => {
  render(<AdminDashboard />); await ready();
  fireEvent.change(screen.getByLabelText('Thời gian'), { target: { value: '7d' } });
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/dashboard/analytics?range=7d&refresh=0'));
  fireEvent.change(screen.getByLabelText('Thời gian'), { target: { value: 'custom' } });
  fireEvent.change(screen.getByLabelText('Từ ngày (UTC)'), { target: { value: '2001-01-01' } });
  fireEvent.change(screen.getByLabelText('Đến ngày (UTC)'), { target: { value: '2001-01-07' } });
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/dashboard/analytics?range=custom&refresh=0&start=2001-01-01&end=2001-01-07'));
});
it('filters descendant products, retains compatible product and resets incompatible product', async () => {
  render(<AdminDashboard />); await ready();
  fireEvent.change(screen.getByLabelText('Danh mục'), { target: { value: '1' } });
  expect(within(screen.getByLabelText('Sản phẩm')).queryByText('Sapphire Blue')).toBeNull();
  expect(within(screen.getByLabelText('Sản phẩm')).getByText('Ruby Star (ẩn)')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Sản phẩm'), { target: { value: '11' } }); await ready();
  fireEvent.change(screen.getByLabelText('Danh mục'), { target: { value: '3' } });
  expect(screen.getByLabelText('Sản phẩm').value).toBe('11');
  fireEvent.change(screen.getByLabelText('Danh mục'), { target: { value: '2' } });
  expect(screen.getByLabelText('Sản phẩm').value).toBe('');
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/dashboard/analytics?range=30d&refresh=0&categoryId=2'));
});
it('drills category to product using accessible legend while retaining donut comparison', async () => {
  render(<AdminDashboard />); await ready();
  fireEvent.click(screen.getByRole('button', { name: /^Ruby / }));
  fireEvent.click(await screen.findByRole('button', { name: /^Ruby Star / }));
  expect((await screen.findByRole('button', { pressed: true })).textContent).toContain('Đang chọn');
  expect(screen.getByRole('button', { name: /^Ruby Oval / })).toBeTruthy();
  expect(screen.getByLabelText('Sản phẩm').value).toBe('11');
  const donut = charts.filter(c => c.type === 'doughnut').at(-1);
  expect(donut.data.datasets[0].offset).toEqual([8, 0]);
  expect(donut.data.datasets[0].data).toEqual([2000000, 1000000]);
});
it('switches metrics, handles slice click, preserves metric selection and destroys old charts', async () => {
  render(<AdminDashboard />); await ready();
  fireEvent.change(screen.getByLabelText('Chỉ số'), { target: { value: 'orders' } });
  expect(charts.filter(c => c.type === 'line').at(-1).data.datasets[0].data).toEqual([1]);
  fireEvent.change(screen.getByLabelText('Cơ cấu'), { target: { value: 'unitsSold' } });
  expect(charts.filter(c => c.type === 'doughnut').at(-1).data.datasets[0].data).toEqual([2, 2]);
  await act(async () => charts.filter(c => c.type === 'doughnut').at(-1).options.onClick({}, [{ index: 0 }]));
  await ready(); expect(screen.getByLabelText('Danh mục').value).toBe('1');
  expect(screen.getByLabelText('Chỉ số').value).toBe('orders'); expect(destroy).toHaveBeenCalled();
});
it('renders empty results and no meaningless donut', async () => {
  api.get.mockImplementation(path => Promise.resolve({ data: path.includes('/options') ? options : {
    ...response(path), summary: { revenue: 0, unitsSold: 0, completedOrders: 0, averageOrderValue: 0 }, breakdown: [],
  } }));
  render(<AdminDashboard />); await ready();
  expect(screen.getByText(/Chưa có doanh số/)).toBeTruthy();
  expect(screen.getByText(/Chưa có dữ liệu cơ cấu/)).toBeTruthy();
  expect(charts.some(c => c.type === 'doughnut')).toBe(false);
});
it('separates loading/API failure and retries', async () => {
  api.get.mockRejectedValue(new Error('offline')); render(<AdminDashboard />);
  expect(screen.getByRole('status').textContent).toContain('Đang tải');
  await screen.findByRole('alert');
  api.get.mockImplementation(mockSuccess);
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  await ready(); expect(screen.queryByRole('alert')).toBeNull();
});
it('ignores stale previous-filter responses', async () => {
  let resolveOld;
  api.get.mockImplementation(path => path.includes('/options') ? Promise.resolve({ data: options }) :
    path.includes('range=30d') ? new Promise(resolve => { resolveOld = resolve; }) : mockSuccess(path));
  render(<AdminDashboard />);
  fireEvent.change(screen.getByLabelText('Thời gian'), { target: { value: '7d' } }); await ready();
  await act(async () => resolveOld({ data: { ...response(''), summary: { revenue: 999, unitsSold: 999, completedOrders: 999, averageOrderValue: 999 } } }));
  expect(screen.queryByText('999')).toBeNull();
});
