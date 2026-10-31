import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../api/api', () => ({ default: mocks }));
import Contact from './Contact';
import { site } from '../config/site';
import { saveSession } from '../auth/session';
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); });
afterEach(() => { cleanup(); site.phone = ''; site.openingHours = ''; site.socialLinks = []; });
function mount() { render(<MemoryRouter><Contact /></MemoryRouter>); }
function fill() {
  for (const [name, value] of [['Họ và tên *', 'Nguyễn An'], ['Email *', 'an@example.invalid'], ['Chủ đề *', 'Tư vấn sản phẩm'], ['Nội dung *', 'Tôi cần tư vấn chọn đá quý.']])
    fireEvent.change(screen.getByLabelText(name), { target: { value } });
}
it('renders real contact form without invented contact information', () => {
  mount();
  expect(screen.getByRole('heading', { name: 'Liên hệ với Gem Aurelia' })).toBeTruthy();
  expect(screen.getByText('Thông tin liên hệ đang được cập nhật.')).toBeTruthy();
  expect(screen.queryByRole('link')).toBeNull();
  expect(screen.getByRole('button', { name: 'Gửi liên hệ' }).closest('form').noValidate).toBe(true);
});
it('shows only configured information and filters unsafe social URLs', () => {
  site.phone = '0123456789'; site.openingHours = 'Theo lịch hẹn';
  site.socialLinks = [{ label: 'Unsafe', url: 'javascript:alert(1)' }];
  mount();
  expect(screen.getByRole('link', { name: site.phone }).getAttribute('href')).toBe('tel:' + site.phone);
  expect(screen.getByText('Theo lịch hẹn')).toBeTruthy();
  expect(screen.queryByText('Unsafe')).toBeNull();
});
it('validates inline and clears corrected field errors', () => {
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Gửi liên hệ' }));
  expect(mocks.post).not.toHaveBeenCalled();
  const name = screen.getByLabelText('Họ và tên *');
  expect(name.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(name.getAttribute('aria-describedby')).textContent).toContain('Vui lòng nhập');
  fill(); expect(name.getAttribute('aria-invalid')).toBe('false');
  fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'invalid' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi liên hệ' }));
  expect(screen.getByText('Email không đúng định dạng.')).toBeTruthy();
  expect(mocks.post).not.toHaveBeenCalled();
});
it('submits once while pending, resets only after API success and re-enables', async () => {
  let resolve; mocks.post.mockImplementation(() => new Promise(done => { resolve = done; }));
  mount(); fill();
  const form = screen.getByRole('button', { name: 'Gửi liên hệ' }).closest('form');
  await act(async () => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(mocks.post).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Đang gửi...' }).closest('fieldset').disabled).toBe(true);
  await act(async () => resolve({ data: {} }));
  expect(screen.getByRole('status').textContent).toContain('Đã gửi yêu cầu liên hệ');
  expect(screen.getByLabelText('Họ và tên *').value).toBe('');
  expect(screen.getByRole('button', { name: 'Gửi liên hệ' }).closest('fieldset').disabled).toBe(false);
  expect(mocks.post.mock.calls[0][1].userId).toBeUndefined();
});
it('retains form on failure without leaking raw exception text', async () => {
  mocks.post.mockRejectedValue({ response: { status: 500, data: { message: 'SqlException secret' } } });
  mount(); fill();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Gửi liên hệ' })));
  expect(screen.getByRole('alert').textContent).toContain('Chưa thể gửi liên hệ');
  expect(screen.queryByText(/SqlException/)).toBeNull();
  expect(screen.getByLabelText('Họ và tên *').value).toBe('Nguyễn An');
  expect(screen.queryByRole('status')).toBeNull();
});
it('clears previous session draft and ignores its pending response', async () => {
  let resolve; mocks.post.mockImplementation(() => new Promise(done => { resolve = done; }));
  mount(); fill();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Gửi liên hệ' })));
  act(() => saveSession({ token: 'other-session', role: 'Customer', fullName: 'Other' }));
  await act(async () => resolve({}));
  expect(screen.getByLabelText('Họ và tên *').value).toBe('');
  expect(screen.queryByRole('status')).toBeNull();
});
