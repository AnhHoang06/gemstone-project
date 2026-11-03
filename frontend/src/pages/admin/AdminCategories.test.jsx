import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock('../../api/api', () => ({ default: api }));
const cache = vi.hoisted(() => ({ invalidateCategoryTree: vi.fn() }));
vi.mock('../../hooks/useCategoryTree', () => cache);
import AdminCategories from './AdminCategories';
const rows = [
  { id: 1, name: 'Ruby', parentId: null, sortOrder: 0, isActive: true },
  { id: 2, name: 'Nhẫn', parentId: 1, sortOrder: 0, isActive: false },
  { id: 3, name: 'Đính đá', parentId: 2, sortOrder: 0, isActive: true },
  { id: 4, name: 'Sapphire', parentId: null, sortOrder: 1, isActive: true },
];
beforeEach(() => { vi.resetAllMocks(); api.get.mockResolvedValue({ data: rows }); api.put.mockResolvedValue({}); });
afterEach(cleanup);
const parentOptions = () => within(screen.getByLabelText('Danh mục cha')).getAllByRole('option').map(option => option.textContent);
it('loads hidden categories and excludes self, descendants, and parents that would exceed three levels', async () => {
  render(<AdminCategories />); await screen.findByRole('row', { name: 'Sửa danh mục Ruby' });
  expect(api.get).toHaveBeenCalledWith('/categories?includeInactive=true');
  // New category (height 1): any level-1 or level-2 parent.
  expect(parentOptions()).toEqual(['Không có (cấp 1)', 'Ruby', '— Nhẫn (Ẩn)', 'Sapphire']);
  // Ruby already has 3 levels (Ruby → Nhẫn → Đính đá): it can only stay a root.
  fireEvent.click(screen.getByRole('row', { name: 'Sửa danh mục Ruby' }));
  expect(parentOptions()).toEqual(['Không có (cấp 1)']);
  // Nhẫn has 2 levels: only level-1 parents; never itself or its child.
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' })); expect(screen.getByLabelText('Tên danh mục').value).toBe('');
  fireEvent.click(screen.getByRole('row', { name: 'Sửa danh mục Nhẫn' }));
  expect(parentOptions()).toEqual(['Không có (cấp 1)', 'Ruby', 'Sapphire']);
  // Đính đá is a leaf: level-1 and level-2 parents (except itself).
  fireEvent.click(screen.getByRole('row', { name: 'Sửa danh mục Đính đá' }));
  expect(parentOptions()).toEqual(['Không có (cấp 1)', 'Ruby', '— Nhẫn (Ẩn)', 'Sapphire']);
});
it('keyboard row selection retains parent, visibility, sort and submits numeric IDs', async () => {
  render(<AdminCategories />); const row = await screen.findByRole('row', { name: 'Sửa danh mục Nhẫn' });
  fireEvent.keyDown(row, { key: 'Enter' });
  expect(screen.getByLabelText('Danh mục cha').value).toBe('1'); expect(screen.getByRole('checkbox').checked).toBe(false);
  fireEvent.change(screen.getByLabelText('Danh mục cha'), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText('Thứ tự hiển thị'), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/categories/2', { name: 'Nhẫn', description: '', isActive: false, parentId: 4, sortOrder: 5 }));
  // Storefront tree cache (Header/Home/shop) is invalidated after an admin edit.
  await waitFor(() => expect(cache.invalidateCategoryTree).toHaveBeenCalledTimes(1));
});
it('always sends parentId and sortOrder on update, including a root parent', async () => {
  render(<AdminCategories />); fireEvent.click(await screen.findByRole('row', { name: 'Sửa danh mục Sapphire' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/categories/4', { name: 'Sapphire', description: '', isActive: true, parentId: null, sortOrder: 1 }));
});
