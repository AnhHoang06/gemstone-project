import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Header from './Header';
import Footer from './Footer';
vi.mock('../hooks/useCategoryTree', () => ({ default: () => ({ data: [], loading: false, error: null }) }));
vi.mock('../commerce/context', () => ({ useCommerce: () => ({ token: null, cart: null, cartError: null }) }));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); delete HTMLDialogElement.prototype.showModal; delete HTMLDialogElement.prototype.close; });
function verifyLinks(container) {
  expect(within(container).queryByRole('link', { name: 'Kiến thức' })).toBeNull();
  expect(container.querySelector('a[href="/kien-thuc"]')).toBeNull();
  expect(within(container).getByRole('link', { name: 'Liên hệ' }).getAttribute('href')).toBe('/lien-he');
  expect(within(container).getByRole('link', { name: 'Hẹn lịch' }).getAttribute('href')).toBe('/hen-lich');
}
it('desktop header removes knowledge while retaining contact, booking and support', () => {
  render(<MemoryRouter><Header /></MemoryRouter>);
  verifyLinks(screen.getByRole('navigation', { name: 'Điều hướng chính' }));
  expect(screen.getByRole('link', { name: 'Hỗ trợ' }).getAttribute('href')).toBe('/ho-tro');
});
it('mobile drawer retains its remaining destinations without knowledge', () => {
  render(<MemoryRouter><Header /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Mở menu điều hướng' }));
  const nav = screen.getByRole('navigation', { name: 'Điều hướng di động' });
  verifyLinks(nav);
  expect(within(nav).getByRole('link', { name: 'Hỗ trợ' }).getAttribute('href')).toBe('/ho-tro');
});
it('footer retains support/contact/booking without the removed destination', () => {
  render(<MemoryRouter><Footer /></MemoryRouter>);
  verifyLinks(screen.getByRole('contentinfo'));
  expect(screen.getByRole('link', { name: 'Hỗ trợ' }).getAttribute('href')).toBe('/ho-tro');
});
