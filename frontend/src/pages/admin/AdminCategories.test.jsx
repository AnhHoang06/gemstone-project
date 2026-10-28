import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock('../../api/api', () => ({ default: api }));
import AdminCategories from './AdminCategories';
const rows = [
  { id: 1, name: 'Ruby', parentId: null, sortOrder: 0, isActive: true },
  { id: 2, name: 'Nhẫn', parentId: 1, sortOrder: 0, isActive: false },
  { id: 3, name: 'Đính đá', parentId: 2, sortOrder: 0, isActive: true },
  { id: 4, name: 'Sapphire', parentId: null, sortOrder: 1, isActive: true },
];
beforeEach(() => { vi.resetAllMocks(); api.get.mockResolvedValue({ data: rows }); api.put.mockResolvedValue({}); });
afterEach(cleanup);
it('loads hidden categories and excludes self, descendants, and depth-three parent choices', async () => {
  render(<AdminCategories />); await screen.findByRole('row', { name: 'Sửa danh mục Ruby' });
  expect(api.get).toHaveBeenCalledWith('/categories?includeInactive=true');
  fireEvent.click(screen.getByRole('row', { name: 'Sửa danh mục Ruby' }));
  const select = screen.getByLabelText('Danh mục cha');
  expect(within(select).queryByText('Ruby')).toBeNull(); expect(within(select).queryByText(/Nhẫn/)).toBeNull(); expect(within(select).queryByText(/Đính đá/)).toBeNull();
  expect(within(select).getByText('Sapphire')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' })); expect(screen.getByLabelText('Tên danh mục').value).toBe('');
});
it('keyboard row selection retains parent, visibility, sort and submits numeric IDs', async () => {
  render(<AdminCategories />); const row = await screen.findByRole('row', { name: 'Sửa danh mục Nhẫn' });
  fireEvent.keyDown(row, { key: 'Enter' });
  expect(screen.getByLabelText('Danh mục cha').value).toBe('1'); expect(screen.getByRole('checkbox').checked).toBe(false);
  fireEvent.change(screen.getByLabelText('Danh mục cha'), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText('Thứ tự hiển thị'), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/categories/2', { name: 'Nhẫn', description: '', isActive: false, parentId: 4, sortOrder: 5 }));
});
