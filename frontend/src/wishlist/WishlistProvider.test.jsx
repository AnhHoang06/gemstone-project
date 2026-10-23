import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), request: vi.fn(), logout: vi.fn() }));
vi.mock("../api/api", () => ({ default: { get: mocks.get, request: mocks.request }, resolveImageUrl: value => value }));
vi.mock("../auth/session", async original => ({ ...await original(), logout: mocks.logout }));
import WishlistProvider from "./WishlistProvider";
import FavoriteToggle from "../components/FavoriteToggle";
import Wishlist from "../pages/Wishlist";
import { CommerceContext } from "../commerce/context";
import { saveSession, clearSession, getSessionToken } from "../auth/session";
import { useWishlist } from "./context";

const ruby = { id: 1, name: "Ruby", categoryName: "Gem", price: 1000000, stock: 2, isActive: true };
const token = name => `${btoa('{}')}.${btoa(JSON.stringify({ name, exp: Date.now() / 1000 + 600 }))}.c2ln`.replaceAll("=", "");
const session = name => saveSession({ token: token(name), fullName: name, role: "Customer" });
function Probe() {
  const { refresh, items } = useWishlist();
  return <><button onClick={refresh}>Refresh probe</button><output data-testid="ids">{items?.map(x => x.id).join(',') ?? 'unknown'}</output></>;
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.resetAllMocks();
  mocks.get.mockResolvedValue({ data: [] });
});
afterEach(cleanup);
async function mount(page = false) {
  await act(async () => { render(<MemoryRouter><CommerceContext.Provider value={{ cartBusy: false }}>
    <WishlistProvider><div data-testid="card"><FavoriteToggle product={ruby} /></div>
      <div data-testid="detail"><FavoriteToggle product={ruby} /></div><Probe />{page && <Wishlist />}
    </WishlistProvider></CommerceContext.Provider></MemoryRouter>); });
}
const heart = area => within(screen.getByTestId(area)).getByRole('button', { name: /yêu thích:/i });

it("synchronizes card/detail/list after add/remove and prevents duplicate clicks", async () => {
  session('A'); await mount(true);
  expect(heart('card').getAttribute('aria-pressed')).toBe('false');
  let complete;
  mocks.request.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  await act(async () => { fireEvent.click(heart('card')); fireEvent.click(heart('detail')); });
  expect(mocks.request).toHaveBeenCalledExactlyOnceWith({ method: 'post', url: '/wishlist/1' });
  expect(heart('card').disabled).toBe(true);
  await act(async () => { complete({ data: [ruby] }); });
  expect(heart('card').getAttribute('aria-pressed')).toBe('true');
  expect(heart('detail').getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('heading', { name: 'Ruby' })).toBeTruthy();
  mocks.request.mockResolvedValueOnce({ data: [] });
  await act(async () => { fireEvent.click(heart('detail')); });
  expect(mocks.request).toHaveBeenLastCalledWith({ method: 'delete', url: '/wishlist/1' });
  expect(heart('card').getAttribute('aria-pressed')).toBe('false');
  expect(screen.queryByRole('heading', { name: 'Ruby' })).toBeNull();
  expect(screen.getByText(/Bạn chưa có sản phẩm yêu thích/)).toBeTruthy();
});

it("keeps state on mutation failure and reloads before retrying an ambiguous result", async () => {
  session('A'); mocks.get.mockResolvedValue({ data: [ruby] }); await mount(true);
  mocks.request.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { fireEvent.click(heart('card')); });
  expect(heart('detail').getAttribute('aria-pressed')).toBe('true');
  expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  mocks.get.mockResolvedValue({ data: [] });
  await act(async () => { fireEvent.click(heart('card')); });
  expect(mocks.request).toHaveBeenCalledTimes(1);
  expect(heart('detail').getAttribute('aria-pressed')).toBe('false');
});

it("shows fetch failure rather than an empty wishlist and retries without guessing a toggle", async () => {
  session('A'); mocks.get.mockRejectedValue(new Error('offline')); await mount(true);
  expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  expect(screen.queryByText(/Bạn chưa có sản phẩm yêu thích/)).toBeNull();
  mocks.get.mockResolvedValue({ data: [ruby] });
  await act(async () => { fireEvent.click(heart('card')); });
  expect(mocks.request).not.toHaveBeenCalled();
  expect(heart('card').getAttribute('aria-pressed')).toBe('true');
});

it("does not let a late refresh overwrite a newer mutation snapshot", async () => {
  session('A'); await mount();
  let oldGet;
  mocks.get.mockImplementationOnce(() => new Promise(resolve => { oldGet = resolve; }));
  await act(async () => { fireEvent.click(screen.getByText('Refresh probe')); });
  mocks.request.mockResolvedValueOnce({ data: [ruby] });
  await act(async () => { fireEvent.click(heart('card')); });
  await act(async () => { oldGet({ data: [] }); });
  expect(heart('card').getAttribute('aria-pressed')).toBe('true');
});

it("clears on account switch/logout and ignores old-session GET and mutation responses", async () => {
  session('A'); await mount();
  let oldGet, oldMutation;
  mocks.get.mockImplementationOnce(() => new Promise(resolve => { oldGet = resolve; }));
  await act(async () => { fireEvent.click(screen.getByText('Refresh probe')); });
  mocks.request.mockImplementationOnce(() => new Promise(resolve => { oldMutation = resolve; }));
  await act(async () => { fireEvent.click(heart('card')); });
  mocks.get.mockResolvedValue({ data: [] });
  await act(async () => { session('B'); });
  await act(async () => { oldGet({ data: [ruby] }); oldMutation({ data: [ruby] }); });
  expect(heart('card').getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByTestId('ids').textContent).toBe('');
  mocks.request.mockResolvedValueOnce({ data: [ruby] });
  await act(async () => { fireEvent.click(heart('card')); });
  expect(heart('card').getAttribute('aria-pressed')).toBe('true');
  await act(async () => { clearSession(); });
  expect(heart('card').getAttribute('aria-pressed')).toBe('false');
  expect(getSessionToken()).toBe('');
});

it("uses the login flow for anonymous favorite clicks without calling the API", async () => {
  await mount();
  await act(async () => { fireEvent.click(heart('card')); });
  expect(mocks.logout).toHaveBeenCalledOnce();
  expect(mocks.get).not.toHaveBeenCalled();
  expect(mocks.request).not.toHaveBeenCalled();
  expect(heart('card').getAttribute('aria-pressed')).toBe('false');
});
