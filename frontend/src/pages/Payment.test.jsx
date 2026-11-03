import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../api/api', () => ({ default: mocks }));
import Payment from './Payment';
import { CommerceContext } from '../commerce/context';
import { saveSession } from '../auth/session';
let payload;
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });
async function mount(overrides = {}) {
  saveSession({ token: 'A', role: 'Customer', fullName: 'A' });
  payload = { order: { id: 52, totalAmount: 6000000, paymentMethod: 'BankTransfer', paymentStatus: 'Unpaid', status: 'Pending', paymentReportedAt: null },
    qrImage: 'data:image/png;base64,test', bankConfigured: true, bankName: 'Test bank', accountNumber: 'test-account', accountHolder: 'Test holder', transferContent: 'DH52', transferAmount: '6000000', ...overrides };
  mocks.get.mockImplementation(async () => ({ data: structuredClone(payload) }));
  await act(async () => { render(<MemoryRouter initialEntries={['/payment/52']}><CommerceContext.Provider value={{ token: 'A', revision: 0 }}>
    <Routes><Route path="/payment/:id" element={<Payment />} /></Routes></CommerceContext.Provider></MemoryRouter>); });
}
it('persists report only after success, prevents double clicks and refetches Unpaid awaiting verification', async () => {
  let finish;
  mocks.post.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await mount();
  expect(screen.getByText('DH52')).toBeTruthy(); expect(screen.getByText('test-account')).toBeTruthy();
  expect(screen.getByText('Thanh toán: Chờ thanh toán')).toBeTruthy();
  const button = screen.getByRole('button', { name: 'Tôi đã chuyển khoản' });
  fireEvent.click(button); fireEvent.click(button);
  expect(mocks.post).toHaveBeenCalledTimes(1); expect(button.disabled).toBe(true);
  expect(mocks.post).toHaveBeenCalledWith('/orders/52/payment-reported');
  await act(async () => { payload.order.paymentReportedAt = '2026-11-01T10:00:00Z'; finish({ data: {} }); });
  expect(screen.getByText('Đã báo chuyển khoản - Đang chờ cửa hàng xác nhận thanh toán')).toBeTruthy();
  expect(screen.getByText('Thanh toán: Chờ xác nhận thanh toán')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Tôi đã chuyển khoản' })).toBeNull();
  expect(payload.order.paymentStatus).toBe('Unpaid');
});
it('renders persisted report after reopening, without a local-only acknowledgment', async () => {
  await mount({ order: { id: 52, totalAmount: 1, paymentMethod: 'BankTransfer', paymentStatus: 'Unpaid', status: 'Pending', paymentReportedAt: '2026-11-01T10:00:00Z' } });
  expect(screen.getByText('Đã báo chuyển khoản - Đang chờ cửa hàng xác nhận thanh toán')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Tôi đã chuyển khoản' })).toBeNull();
});
it('shows verified state without asking for another transfer', async () => {
  await mount({ order: { id: 52, totalAmount: 1, paymentMethod: 'BankTransfer', paymentStatus: 'Paid', status: 'Confirmed' } });
  expect(screen.getByText('Đã thanh toán - Đơn đã được xác nhận')).toBeTruthy();
  expect(screen.queryByText('test-account')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Tôi đã chuyển khoản' })).toBeNull();
});
it('shows report failure without pretending it was saved', async () => {
  mocks.post.mockRejectedValue(new Error('network')); await mount();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Tôi đã chuyển khoản' })));
  expect(screen.getByRole('alert').textContent).toContain('Không gửi được');
  expect(screen.getByRole('button', { name: 'Tôi đã chuyển khoản' }).disabled).toBe(false);
  expect(screen.queryByText('Đã báo chuyển khoản - Đang chờ cửa hàng xác nhận thanh toán')).toBeNull();
});
it('ignores completion from a previous session', async () => {
  let finish; mocks.post.mockImplementation(() => new Promise(resolve => { finish = resolve; })); await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Tôi đã chuyển khoản' }));
  saveSession({ token: 'B', role: 'Customer', fullName: 'B' });
  await act(async () => finish({ data: {} }));
  expect(mocks.get).toHaveBeenCalledTimes(1);
});
it('does not invent bank details when configuration is missing', async () => {
  await mount({ bankConfigured: false });
  expect(screen.queryByText('test-account')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Tôi đã chuyển khoản' })).toBeNull();
  expect(screen.getByRole('status').textContent).toContain('Thông tin chuyển khoản hiện chưa được cấu hình.');
});
it('does not offer transfer for a cancelled order', async () => {
  await mount({ order: { id: 52, paymentMethod: 'BankTransfer', paymentStatus: 'Unpaid', status: 'Cancelled', totalAmount: 1 } });
  expect(screen.queryByText('test-account')).toBeNull();
  expect(screen.getByText(/Đơn đã hủy/)).toBeTruthy();
});

it('renders the local QR with exact order information and hides it after payment', async () => {
  await mount();
  const qr = screen.getByRole('img', { name: /QR chuyển khoản đơn DH52/ });
  expect(qr.getAttribute('src')).toBe('data:image/png;base64,test');
  expect(qr.getAttribute('alt')).toContain('6.000.000');
});

it.each([['số tài khoản', 'test-account'], ['số tiền', '6000000'], ['nội dung chuyển khoản', 'DH52']])('copies backend %s without formatting or recomputing it', async (label, value) => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText } }); await mount();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: `Sao chép ${label}` })));
  expect(writeText).toHaveBeenCalledWith(value);
  expect(screen.getByText('Đã sao chép')).toBeTruthy(); expect(mocks.post).not.toHaveBeenCalled();
});
it('does not show copy success when clipboard permission is denied', async () => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } }); await mount();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Sao chép số tài khoản' })));
  expect(screen.queryByText('Đã sao chép')).toBeNull();
  expect(screen.getByText(/Không thể sao chép/)).toBeTruthy();
});
it('COD displays its payment method without QR, copy controls or report action', async () => {
  await mount({ order: { id: 52, paymentMethod: 'COD', paymentStatus: 'Unpaid', status: 'Pending', totalAmount: 6000000 } });
  expect(screen.getByText('Thanh toán khi nhận hàng (COD)')).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.queryByRole('button', { name: /Sao chép/ })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Tôi đã chuyển khoản' })).toBeNull();
});
it('QR has square reserved dimensions and responsive class, with all bank information visible', async () => {
  await mount(); const qr = screen.getByRole('img');
  expect(qr.getAttribute('width')).toBe(qr.getAttribute('height'));
  expect(qr.className).toBe('payment-qr');
  expect(screen.getByText('Test bank')).toBeTruthy(); expect(screen.getByText('Test holder')).toBeTruthy();
});
it('copies the exact amount string supplied by the backend, without deriving it from the display value', async () => {
  const writeText=vi.fn().mockResolvedValue(undefined);vi.stubGlobal('navigator',{clipboard:{writeText}});
  await mount({transferAmount:'6000000.25'});
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Sao chép số tiền'})));
  expect(writeText).toHaveBeenCalledWith('6000000.25');
});

it('prevents duplicate copy requests and ignores completion from a previous session', async () => {
  let finish; const writeText=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
  vi.stubGlobal('navigator',{clipboard:{writeText}});await mount();
  const button=screen.getByRole('button',{name:'Sao chép số tài khoản'});fireEvent.click(button);fireEvent.click(button);
  expect(writeText).toHaveBeenCalledTimes(1);expect(button.disabled).toBe(true);
  saveSession({token:'B',role:'Customer',fullName:'B'});await act(async()=>finish());
  expect(screen.queryByText('Đã sao chép')).toBeNull();
});
it('supports manual copying when Clipboard API is unavailable', async () => {
  vi.stubGlobal('navigator',{});await mount();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Sao chép nội dung chuyển khoản'})));
  expect(screen.getByText(/Không thể sao chép/)).toBeTruthy();expect(screen.getByText('DH52')).toBeTruthy();
});
