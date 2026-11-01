import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import SupportPage from './SupportPage';
import { filterSupportFaq, normalizeHelpSearch, supportFaq, supportLinks } from '../data/supportContent';

afterEach(cleanup);
function mount() { return render(<MemoryRouter initialEntries={['/ho-tro']}><Routes><Route path="/ho-tro" element={<SupportPage />} /><Route path="/lien-he" element={<h1>Trang liên hệ</h1>} /></Routes></MemoryRouter>); }
function search(value) { fireEvent.change(screen.getByRole('searchbox', { name: 'Bạn cần hỗ trợ điều gì?' }), { target: { value } }); }
it('renders public help, eight topics, status guide and no contact form', () => {
  mount();
  expect(screen.getByRole('heading', { level: 1, name: 'Trung tâm hỗ trợ' })).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe(`${supportFaq.length} câu hỏi phù hợp`);
  expect(screen.getByRole('button', { name: 'Sản phẩm & kiểm định' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Chờ xác nhận' })).toBeTruthy();
  expect(screen.getByText(/Đơn đã dừng xử lý/)).toBeTruthy();
  expect(document.querySelector('form')).toBeNull();
});
it('searches Vietnamese accents, decomposed Unicode, title, content and keywords', () => {
  expect(normalizeHelpSearch(' ĐỔI MẬT KHẨU ')).toBe('doi mat khau');
  expect(filterSupportFaq('đổi mật khẩu'.normalize('NFD')).map(x => x.id)).toEqual(['password']);
  expect(filterSupportFaq('verified purchase').map(x => x.id)).toEqual(['review-eligibility']);
  expect(filterSupportFaq('tùy chọn').map(x => x.id)).toEqual(['place-order']);
  mount(); search('DOI MAT KHAU');
  expect(screen.getByRole('button', { name: 'Tôi đổi mật khẩu như thế nào?' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Làm thế nào để đặt hàng?' })).toBeNull();
});
it('combines topic and query, clears both and returns focus to search', () => {
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Thanh toán', exact: true }));
  expect(screen.getByRole('button', { name: 'Thanh toán', exact: true }).getAttribute('aria-pressed')).toBe('true');
  search('mật khẩu');
  expect(screen.getByText('Không tìm thấy nội dung phù hợp.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
  expect(screen.getByRole('status').textContent).toBe(`${supportFaq.length} câu hỏi phù hợp`);
  expect(document.activeElement).toBe(screen.getByRole('searchbox'));
  expect(screen.getByRole('button', { name: 'Tất cả chủ đề' }).getAttribute('aria-pressed')).toBe('true');
});
it('accordion uses focusable native buttons and matching controls; multiple answers can remain open', () => {
  mount();
  const button = screen.getByRole('button', { name: 'Làm thế nào để đặt hàng?' });
  const answer = document.getElementById(button.getAttribute('aria-controls'));
  expect(button.tagName).toBe('BUTTON'); expect(button.type).toBe('button');
  button.focus(); expect(document.activeElement).toBe(button);
  expect(button.getAttribute('aria-expanded')).toBe('false'); expect(answer.hidden).toBe(true);
  fireEvent.click(button);
  expect(button.getAttribute('aria-expanded')).toBe('true'); expect(answer.hidden).toBe(false);
  expect(within(answer).getByText(/không tự ghi đè hồ sơ/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Tôi xem đơn hàng ở đâu?' }));
  expect(answer.hidden).toBe(false);
  fireEvent.click(button); expect(answer.hidden).toBe(true);
});
it('quick actions keep existing routes and Contact CTA navigates without duplicating chat', () => {
  mount(); const nav = screen.getByRole('navigation', { name: 'Liên kết nhanh' });
  for (const link of supportLinks) expect(within(nav).getByRole('link', { name: new RegExp(link.label) }).getAttribute('href')).toBe(link.to);
  fireEvent.click(screen.getByRole('link', { name: 'Liên hệ với chúng tôi', exact: true }));
  expect(screen.getByRole('heading', { name: 'Trang liên hệ' })).toBeTruthy();
});
it('empty search has a contact fallback and reset', () => {
  mount(); search('zzzzzz');
  expect(screen.getByRole('status').textContent).toBe('0 câu hỏi phù hợp');
  const empty = screen.getByText('Không tìm thấy nội dung phù hợp.').parentElement;
  expect(within(empty).getByRole('link', { name: 'Liên hệ với chúng tôi' }).getAttribute('href')).toBe('/lien-he');
  fireEvent.click(screen.getByRole('button', { name: 'Xem tất cả câu hỏi' }));
  expect(screen.getByRole('searchbox').value).toBe('');
});
it('documents the actual develop payment limitations without claiming unsupported gateways', () => {
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Thanh toán', exact: true }));
  for (const item of supportFaq.filter(x => x.category === 'payment')) fireEvent.click(screen.getByRole('button', { name: item.title }));
  expect(screen.getByText(/Thanh toán khi nhận hàng \(COD\) hoặc Chuyển khoản ngân hàng/)).toBeTruthy();
  expect(screen.getByText(/Hoàn tất chưa tự đánh dấu Đã thanh toán/)).toBeTruthy();
  expect(screen.getByText(/chưa hiển thị mã QR thanh toán/)).toBeTruthy();
  expect(screen.getByText(/chưa gửi báo cáo chuyển khoản đến máy chủ/)).toBeTruthy();
  expect(screen.queryByText(/VNPay|MoMo|Visa/i)).toBeNull();
});
it('states customer cancellation and completed-purchase review eligibility without invented deadlines', () => {
  expect(supportFaq.find(x => x.id === 'cancel-order').content).toContain('chỉ có thể tự hủy đơn của mình khi đơn còn Chờ xác nhận');
  expect(supportFaq.find(x => x.id === 'review-eligibility').content).toContain('trạng thái Hoàn tất');
  expect(supportFaq.map(x => x.content).join(' ')).not.toMatch(/hoàn tiền trong \d|giao trong \d|bảo hành \d/i);
});
