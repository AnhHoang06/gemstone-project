import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../api/api', () => ({ default: mocks, resolveImageUrl: value => value }));
vi.mock('../components/ProductCard', () => ({ default: ({ product }) => <h3>{product.name}</h3> }));
import Products from './Products';
import { invalidateCategoryTree } from '../hooks/useCategoryTree';
const tree = [{ id: 1, name: 'Ruby', children: [{ id: 3, name: 'Nhẫn', children: [] }] }, { id: 2, name: 'Sapphire', children: [] }];
beforeEach(() => {
  vi.resetAllMocks();
  invalidateCategoryTree();
  Element.prototype.scrollIntoView = vi.fn();
  mocks.get.mockImplementation(path => {
    if (path === '/categories/tree') return Promise.resolve({ data: tree });
    const params = new URLSearchParams(path.split('?')[1]);
    const empty = params.has('minPrice');
    const totalPages = empty ? 0 : 3;
    return Promise.resolve({ data: { items: empty ? [] : [{ id: 1, name: 'Ruby A' }], total: empty ? 0 : 30, page: Math.max(1, Math.min(Number(params.get('page') || 1), totalPages)), totalPages } });
  });
});
afterEach(cleanup);
function Location() { const navigate = useNavigate(); return <><output data-testid="url">{useLocation().search}</output><button onClick={() => navigate(-1)}>Back</button></>; }
it('canonicalizes legacy category name and preserves filters on category/page/sort changes', async () => {
  await act(async () => { render(<MemoryRouter initialEntries={['/shop?category=ruby&q=da&page=2']}><Products /><Location /></MemoryRouter>); });
  await screen.findByRole('heading', { name: 'Ruby A' });
  await waitFor(() => expect(screen.getByTestId('url').textContent).toContain('category=1'));
  expect(screen.getByRole('combobox', { name: 'Tìm đá quý theo tên' }).value).toBe('da');
  fireEvent.click(screen.getByRole('link', { name: 'Sapphire', exact: true }));
  await waitFor(() => expect(screen.getByTestId('url').textContent).toBe('?category=2&q=da'));
  await screen.findByRole('button', { name: 'Trang 2', exact: true });
  fireEvent.click(screen.getByRole('button', { name: 'Trang 2', exact: true }));
  await waitFor(() => expect(screen.getByTestId('url').textContent).toBe('?category=2&q=da&page=2'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Trang 2', exact: true }).getAttribute('aria-current')).toBe('page'));
  fireEvent.change(screen.getByLabelText('Sắp xếp'), { target: { value: 'price-desc' } });
  expect(screen.getByTestId('url').textContent).toBe('?category=2&q=da&sort=price-desc');
  fireEvent.click(screen.getByText('Back'));
  await waitFor(() => expect(screen.getByTestId('url').textContent).toBe('?category=2&q=da&page=2'));
});
it('sends price filters to server, validates ranges, and clears all URL state from empty result', async () => {
  render(<MemoryRouter initialEntries={['/shop?category=1&page=2']}><Products /><Location /></MemoryRouter>);
  await screen.findByText('30 sản phẩm');
  fireEvent.change(screen.getByLabelText('Giá từ (đ)'), { target: { value: '200' } });
  fireEvent.change(screen.getByLabelText('Đến (đ)'), { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lọc giá' }));
  expect(screen.getByRole('alert').textContent).toBe('Khoảng giá không hợp lệ.');
  fireEvent.change(screen.getByLabelText('Đến (đ)'), { target: { value: '300' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lọc giá' }));
  await screen.findByText('0 sản phẩm');
  expect(mocks.get.mock.calls.some(([url]) => url === '/products/catalog?minPrice=200&maxPrice=300&categoryId=1')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Xem tất cả đá quý' }));
  await screen.findByText('30 sản phẩm');
  expect(screen.getByTestId('url').textContent).toBe('');
  expect(screen.getByLabelText('Giá từ (đ)').value).toBe('');
});
it('replaces an out-of-range or invalid page in the URL with the page the API returned', async () => {
  render(<MemoryRouter initialEntries={['/shop?category=2&page=99']}><Products /><Location /></MemoryRouter>);
  await waitFor(() => expect(screen.getByTestId('url').textContent).toBe('?category=2&page=3'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Trang 3', exact: true }).getAttribute('aria-current')).toBe('page'));
  cleanup();
  render(<MemoryRouter initialEntries={['/shop?q=da&page=abc']}><Products /><Location /></MemoryRouter>);
  await waitFor(() => expect(screen.getByTestId('url').textContent).toBe('?q=da'));
  expect(mocks.get.mock.calls.some(([url]) => url.includes('page=abc'))).toBe(false);
});
it('shows "Danh mục không tồn tại" for an unknown or hidden category instead of products', async () => {
  render(<MemoryRouter initialEntries={['/shop?category=999&q=da']}><Products /><Location /></MemoryRouter>);
  expect(await screen.findByRole('heading', { level: 1, name: 'Danh mục không tồn tại' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Ruby A' })).toBeNull();
  expect(screen.queryByText('30 sản phẩm')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Xem tất cả đá quý' }));
  await screen.findByText('30 sản phẩm');
  expect(screen.getByTestId('url').textContent).toBe('');
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tất cả đá quý');
});
it('treats an unmatched legacy category name as missing', async () => {
  render(<MemoryRouter initialEntries={['/shop?category=topaz']}><Products /></MemoryRouter>);
  expect(await screen.findByRole('heading', { level: 1, name: 'Danh mục không tồn tại' })).toBeTruthy();
  expect(mocks.get.mock.calls.filter(([url]) => url.startsWith('/products/catalog'))).toHaveLength(0);
});
