import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
const get = vi.hoisted(() => vi.fn());
vi.mock('../api/api', () => ({ default: { get } }));
import Payment from './Payment';
import { CommerceContext } from '../commerce/context';
afterEach(() => { cleanup(); get.mockReset(); });
async function mount(overrides = {}) {
  get.mockResolvedValue({ data: { order: { id: 52, totalAmount: 6000000, paymentMethod: 'BankTransfer', paymentStatus: 'Unpaid', status: 'Pending' },
    bankConfigured: true, bankName: 'Test bank', accountNumber: 'test-account', accountHolder: 'Test holder', transferContent: 'DH52', ...overrides } });
  await act(async () => { render(<MemoryRouter initialEntries={['/payment/52']}><CommerceContext.Provider value={{ revision: 0 }}>
    <Routes><Route path="/payment/:id" element={<Payment />} /></Routes></CommerceContext.Provider></MemoryRouter>); });
}
it('shows configured instructions and acknowledgment does not change payment state or call an API', async () => {
  await mount();
  expect(get).toHaveBeenCalledWith('/orders/52/payment');
  expect(screen.getByText('DH52')).toBeTruthy();
  expect(screen.getByText('test-account')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Tôi đã chuyển khoản' }));
  expect(screen.getByRole('status').textContent).toContain('chưa được đánh dấu');
  expect(screen.getByText('Thanh toán: Chưa thanh toán')).toBeTruthy();
  expect(get).toHaveBeenCalledTimes(1);
});
it('does not invent bank details when configuration is missing', async () => {
  await mount({ bankConfigured: false });
  expect(screen.queryByText('test-account')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Tôi đã chuyển khoản' })).toBeNull();
  expect(screen.getByRole('status').textContent).toContain('Chưa có thông tin ngân hàng');
});
it('does not offer transfer for a cancelled order', async () => {
  await mount({ order: { id: 52, paymentMethod: 'BankTransfer', paymentStatus: 'Unpaid', status: 'Cancelled', totalAmount: 1 } });
  expect(screen.queryByText('test-account')).toBeNull();
  expect(screen.getByText(/Đơn đã hủy/)).toBeTruthy();
});
