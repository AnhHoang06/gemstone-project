import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('../../api/api', () => ({ default: mocks }));
import AdminContacts from './AdminContacts';
import AdminContactDetail from './AdminContactDetail';
const item = { id: 4, fullName: 'Nguyễn An', email: 'an@example.invalid', subject: 'Tư vấn sản phẩm', status: 'New', createdAt: '2026-10-20T08:00:00', message: 'Tư vấn Ruby tự nhiên', userId: 10, adminNote: '' };
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); });
afterEach(cleanup);
async function mount(path = '/admin/contacts') {
  await act(async () => render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/admin/contacts" element={<AdminContacts />} />
    <Route path="/admin/contacts/:id" element={<AdminContactDetail />} />
  </Routes></MemoryRouter>));
}
it('loads admin list, applies server status filter and disables next at last page', async () => {
  mocks.get.mockResolvedValue({ data: { total: 1, page: 1, items: [item] } }); await mount();
  expect(screen.getByRole('cell', { name: 'Nguyễn An' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Trang sau' }).disabled).toBe(true);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Đang xử lý' })));
  expect(mocks.get).toHaveBeenLastCalledWith('/admin/contacts', { params: { page: 1, status: 'InProgress' } });
});
it.each(['Enter', ' '])('opens detail with %s on row and saves status/internal note', async key => {
  mocks.get.mockImplementation(path => Promise.resolve({ data: path.endsWith('/4') ? item : { total: 1, items: [item] } }));
  mocks.put.mockResolvedValue({}); await mount();
  await act(async () => fireEvent.keyDown(screen.getByRole('row', { name: 'Mở liên hệ #4' }), { key }));
  expect(screen.getByText(item.message)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'Resolved' } });
  fireEvent.change(screen.getByLabelText('Ghi chú nội bộ'), { target: { value: 'Đã tư vấn' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' })));
  expect(mocks.put).toHaveBeenCalledWith('/admin/contacts/4', { status: 'Resolved', adminNote: 'Đã tư vấn' });
  expect(screen.getByRole('status').textContent).toBe('Đã lưu thay đổi.');
});
it('separates load failure from empty state', async () => {
  mocks.get.mockRejectedValue(new Error('network')); await mount();
  expect(screen.getByRole('alert').textContent).toBe('Không thể tải danh sách liên hệ.');
  expect(screen.queryByText('Chưa có yêu cầu liên hệ phù hợp.')).toBeNull();
});
it('does not show saved state when update fails', async () => {
  mocks.get.mockResolvedValue({ data: item }); mocks.put.mockRejectedValue(new Error('network')); await mount('/admin/contacts/4');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' })));
  expect(screen.getByRole('alert').textContent).toContain('Không thể lưu');
  expect(screen.queryByText('Đã lưu thay đổi.')).toBeNull();
});
