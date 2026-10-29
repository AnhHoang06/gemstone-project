import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import ProductCard from './ProductCard';
import { SPEC_HOVER_DELAY_MS } from '../hooks/useSpecReveal';
import { getProductSpecs } from '../utils/productSpecs';
import { WishlistContext } from '../wishlist/context';
import { CommerceContext } from '../commerce/context';

const fullProduct = { id: 11, name: 'Ruby Myanmar 1,2 ct', price: 52000000, stock: 2, carat: 1.2, color: 'Đỏ huyết bồ câu', clarity: 'VS1', cut: 'Oval', origin: 'Myanmar', certificateAuthority: 'GRS', imageUrl: '/sample-images/ruby-oval.svg' };

function renderCard(product = fullProduct, props = {}) {
  const toggle = vi.fn(), mutateCart = vi.fn().mockResolvedValue(true);
  const view = render(<MemoryRouter><WishlistContext.Provider value={{ items: [], toggle }}><CommerceContext.Provider value={{ mutateCart }}>
    <ProductCard product={product} {...props} />
    <button type="button">Bên ngoài</button>
  </CommerceContext.Provider></WishlistContext.Provider></MemoryRouter>);
  const group = screen.getByRole('group', { name: `Thông số ${product.name}` });
  return { ...view, toggle, mutateCart, group, card: group.closest('article') };
}
const isShown = card => card.classList.contains('is-specs-visible');

afterEach(() => { cleanup(); vi.useRealTimers(); });

it('reveals the specs after the hover delay, ignores quick sweeps and touch pointers', () => {
  vi.useFakeTimers();
  const { card } = renderCard();
  fireEvent.pointerEnter(card, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(SPEC_HOVER_DELAY_MS - 20));
  fireEvent.pointerLeave(card, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(200));
  expect(isShown(card)).toBe(false);

  fireEvent.pointerEnter(card, { pointerType: 'mouse' });
  expect(isShown(card)).toBe(false);
  act(() => vi.advanceTimersByTime(SPEC_HOVER_DELAY_MS));
  expect(isShown(card)).toBe(true);
  fireEvent.pointerLeave(card, { pointerType: 'mouse' });
  expect(isShown(card)).toBe(false);

  fireEvent.pointerEnter(card, { pointerType: 'touch' });
  act(() => vi.advanceTimersByTime(500));
  expect(isShown(card)).toBe(false);
});

it('reveals on keyboard focus inside the card but not on pointer focus, and hides when focus leaves', () => {
  const { card } = renderCard();
  const detail = within(card).getByRole('link', { name: 'Xem chi tiết' });
  fireEvent.focus(detail);
  expect(isShown(card)).toBe(true);
  fireEvent.blur(detail, { relatedTarget: within(card).getByRole('button', { name: 'Thêm vào giỏ' }) });
  expect(isShown(card)).toBe(true);
  fireEvent.blur(detail, { relatedTarget: screen.getByRole('button', { name: 'Bên ngoài' }) });
  expect(isShown(card)).toBe(false);

  fireEvent.pointerDown(detail);
  fireEvent.focus(detail);
  expect(isShown(card)).toBe(false);
});

it('lists only the rows that have data, with the requested labels', () => {
  const { group } = renderCard({ id: 3, name: 'Sapphire Ceylon', price: 1, stock: 1, carat: 2.05, color: '  ', origin: 'Sri Lanka', certificate: { authority: 'GIA' } });
  expect([...group.querySelectorAll('dt')].map(dt => dt.textContent)).toEqual(['Carat', 'Xuất xứ', 'Kiểm định']);
  expect([...group.querySelectorAll('dd')].map(dd => dd.textContent)).toEqual(['2.05 ct', 'Sri Lanka', 'GIA']);
  expect(within(group).queryByText('Chưa có thông số')).toBeNull();
});

it('shows "Chưa có thông số" when the API sent no spec fields (older DTO)', () => {
  const { group } = renderCard({ id: 4, name: 'Garnet', price: 1, stock: 1 }, { variant: 'compact' });
  expect(within(group).getByText('Chưa có thông số')).toBeTruthy();
  expect(group.querySelector('dl')).toBeNull();
  expect(getProductSpecs({ carat: null, color: '', clarity: undefined })).toEqual([]);
});

it('toggles with the touch button, exposes aria-expanded/aria-controls, and closes on Esc or a tap outside', () => {
  const { card, group } = renderCard(fullProduct, { variant: 'compact' });
  const toggleButton = within(card).getByRole('button', { name: `Thông số ${fullProduct.name}` });
  expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
  expect(toggleButton.hasAttribute('aria-controls')).toBe(false);

  fireEvent.click(toggleButton);
  expect(isShown(card)).toBe(true);
  expect(card.classList.contains('is-specs-pinned')).toBe(true);
  expect(toggleButton.getAttribute('aria-expanded')).toBe('true');
  expect(toggleButton.getAttribute('aria-controls')).toBe(group.id);

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(isShown(card)).toBe(false);
  expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
  expect(toggleButton.hasAttribute('aria-controls')).toBe(false);

  fireEvent.click(toggleButton);
  expect(isShown(card)).toBe(true);
  fireEvent.click(toggleButton);
  expect(isShown(card)).toBe(false);

  fireEvent.click(toggleButton);
  fireEvent.click(screen.getByRole('button', { name: 'Bên ngoài' }));
  expect(isShown(card)).toBe(false);

  fireEvent.click(toggleButton);
  fireEvent.click(group);
  expect(isShown(card)).toBe(false);
});

it('Esc dismisses a hover reveal until the pointer leaves', () => {
  vi.useFakeTimers();
  const { card } = renderCard();
  fireEvent.pointerEnter(card, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(SPEC_HOVER_DELAY_MS));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(isShown(card)).toBe(false);
  fireEvent.pointerLeave(card, { pointerType: 'mouse' });
  fireEvent.pointerEnter(card, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(SPEC_HOVER_DELAY_MS));
  expect(isShown(card)).toBe(true);
});

it('covers only the image: heart, cart and detail links stay outside the panel and keep working while it is shown', async () => {
  const { card, group, toggle, mutateCart } = renderCard();
  fireEvent.focus(within(card).getByRole('link', { name: 'Xem chi tiết' }));
  expect(isShown(card)).toBe(true);
  const heart = within(card).getByRole('button', { name: `Yêu thích: ${fullProduct.name}` });
  const cart = within(card).getByRole('button', { name: 'Thêm vào giỏ' });
  const imageLink = within(card).getByRole('link', { name: `Xem chi tiết ${fullProduct.name}` });
  for (const element of [heart, cart, imageLink]) expect(group.contains(element)).toBe(false);
  expect(group.closest('.product-card__visual')).toBe(imageLink.closest('.product-card__visual'));
  expect(imageLink.getAttribute('href')).toBe('/product/11');
  expect(within(imageLink).getByRole('img', { name: fullProduct.name }).getAttribute('src')).toContain('/sample-images/ruby-oval.svg');

  fireEvent.click(heart);
  expect(toggle).toHaveBeenCalledWith(11);
  await act(async () => { fireEvent.click(cart); });
  expect(mutateCart).toHaveBeenCalledWith('post', '/cart/items/11', { quantity: 1 });
  expect(isShown(card)).toBe(true);
});

it('keeps the specs readable by assistive tech without hovering (in the DOM, not aria-hidden)', () => {
  const { group } = renderCard();
  expect(group.getAttribute('aria-hidden')).toBeNull();
  expect(group.hidden).toBe(false);
  expect(within(group).getByText('VS1')).toBeTruthy();
  expect(within(group).getByText('Giác cắt')).toBeTruthy();
  expect(within(group).getByText('Độ tinh khiết')).toBeTruthy();
});
