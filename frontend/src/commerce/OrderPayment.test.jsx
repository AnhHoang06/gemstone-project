import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('../api/api', () => ({ default: mocks }));
import OrderDetailView from './OrderDetailView';
import { CommerceContext } from './context';
import { saveSession } from '../auth/session';
import { paymentLabel } from './paymentStatus';
let order;
afterEach(() => { cleanup(); vi.resetAllMocks(); localStorage.clear(); });
async function mount(overrides = {}) {
  saveSession({ token: 'A', role: 'Admin', fullName: 'A' });
  order = { id: 52, status: 'Pending', paymentMethod: 'COD', paymentStatus: 'Unpaid', createdAt: '2026-11-01T00:00:00Z', totalAmount: 1000000, recipientName: 'Recipient', items: [], ...overrides };
  mocks.get.mockImplementation(async () => ({ data: structuredClone(order) }));
  await act(async () => render(<MemoryRouter initialEntries={['/admin/orders/52']}><CommerceContext.Provider value={{ token: 'A', revision: 0, refreshCart: vi.fn() }}>
    <Routes><Route path="/admin/orders/:id" element={<OrderDetailView admin />} /></Routes></CommerceContext.Provider></MemoryRouter>));
}
it('COD confirms the order and continues to display Unpaid', async () => {
  await mount();
  expect(screen.queryByRole('button', { name: 'Xác nhận đã nhận thanh toán' })).toBeNull();
  mocks.put.mockImplementation(async () => { order.status = 'Confirmed'; return { data: {} }; });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đơn hàng' })));
  expect(mocks.put).toHaveBeenCalledWith('/orders/admin/52/status', { status: 'Confirmed' });
  expect(screen.getByText('Chưa thanh toán')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Xác nhận đơn hàng' })).toBeNull();
});
it('BankTransfer uses one payment action, waits for server and refreshes both states', async () => {
  await mount({ paymentMethod: 'BankTransfer' });
  expect(screen.queryByRole('button', { name: 'Xác nhận đơn hàng' })).toBeNull();
  let finish; mocks.post.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const button = screen.getByRole('button', { name: 'Xác nhận đã nhận thanh toán' });
  fireEvent.click(button); fireEvent.click(button); expect(mocks.post).toHaveBeenCalledTimes(1);
  expect(button.disabled).toBe(true);
  await act(async () => { order = { ...order, status: 'Confirmed', paymentStatus: 'Paid', paidAt: '2026-11-01T10:00:00Z' }; finish({ data: {} }); });
  expect(mocks.post).toHaveBeenCalledWith('/orders/admin/52/confirm-payment');
  expect(screen.getByText('Đã thanh toán')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Xác nhận đã nhận thanh toán' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Hủy đơn' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Chuyển: Đang giao' })).toBeTruthy();
});
it('failed verification leaves payment unpaid and allows retry', async () => {
  await mount({ paymentMethod: 'BankTransfer' }); mocks.post.mockRejectedValue(new Error('network'));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đã nhận thanh toán' })));
  expect(screen.getByRole('alert')).toBeTruthy(); expect(screen.getByText('Chờ thanh toán')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Xác nhận đã nhận thanh toán' }).disabled).toBe(false);
});
it.each(['Completed', 'Cancelled'])('terminal %s has no actions', async status => {
  await mount({ status, paymentMethod: 'BankTransfer', paymentStatus: 'Paid' });
  expect(screen.queryByRole('button', { name: 'Xác nhận đã nhận thanh toán' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Hủy đơn' })).toBeNull();
});
it('distinguishes reported/unpaid, paid and cancelled displays', () => {
  expect(paymentLabel({ status: 'Pending', paymentMethod: 'BankTransfer', paymentStatus: 'Unpaid', paymentReportedAt: 'now' })).toBe('Chờ xác nhận thanh toán');
  expect(paymentLabel({ status: 'Shipping', paymentMethod: 'COD', paymentStatus: 'Unpaid' })).toBe('Chưa thanh toán');
  expect(paymentLabel({ status: 'Completed', paymentMethod: 'COD', paymentStatus: 'Paid' })).toBe('Đã thanh toán');
  expect(paymentLabel({ status: 'Cancelled', paymentMethod: 'BankTransfer', paymentStatus: 'Unpaid', paymentReportedAt: 'now' })).toBe('Chưa thanh toán');
});
