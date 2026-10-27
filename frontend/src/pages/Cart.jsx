import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useCommerce } from "../commerce/context";
import { formatPrice } from "../utils/formatPrice";
import { resolveImageUrl } from "../api/api";
import CheckoutSummary from "../commerce/CheckoutSummary";
import "../styles/cart-checkout.css";

function CartRow({ item, busy, mutate, quantity, setQuantity }) {
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const disabled = busy || !item.isActive;
  async function updateQuantity(value) {
    if (disabled || submitting.current) return;
    const next = Number(value);
    if (value === "" || !Number.isInteger(next) || next < 1 || next > 10000) {
      setQuantity(item.quantity);
      setError("Số lượng phải là số nguyên từ 1 đến 10.000.");
      return;
    }
    if (next === item.quantity) { setQuantity(item.quantity); setError(""); return; }
    submitting.current = true; setError("");
    try {
      const success = await mutate("put", `/cart/items/${item.productId}`, { quantity: next });
      if (!success) setError("Không cập nhật được số lượng. Đã hiển thị lại số lượng từ giỏ hàng.");
    } finally { submitting.current = false; }
  }
  function stepQuantity(delta) {
    const current = Number(quantity);
    void updateQuantity(Math.min(10000, Math.max(1, (Number.isInteger(current) ? current : item.quantity) + delta)));
  }
  return <tr>
    <td data-label="Sản phẩm">{item.imageUrl && <img className="commerce-thumb" src={resolveImageUrl(item.imageUrl)} alt="" />}
      <Link to={`/product/${item.productId}`}>{item.name}</Link>
      {!item.isActive && <p className="notice-error">Đã ngừng bán</p>}
      {item.quantity > item.stock && <p className="notice-error">Chỉ còn {item.stock} sản phẩm</p>}</td>
    <td data-label="Đơn giá">{formatPrice(item.price)}</td>
    <td data-label="Số lượng"><form className="cart-quantity-form" noValidate onSubmit={e => { e.preventDefault(); void updateQuantity(quantity); }}>
      <label className="visually-hidden" htmlFor={`quantity-${item.productId}`}>Số lượng {item.name}</label>
        <div className="cart-quantity-control" role="group" aria-label={`Điều chỉnh số lượng ${item.name}`}>
          <button type="button" className="cart-quantity-step" aria-label={`Giảm số lượng ${item.name}`}
            onPointerDown={e => e.preventDefault()}
            disabled={disabled || Number(quantity) <= 1} onClick={() => stepQuantity(-1)}>−</button>
          <input id={`quantity-${item.productId}`} type="number" min="1" max="10000" step="1" inputMode="numeric" required value={quantity}
            aria-describedby={error ? `quantity-error-${item.productId}` : undefined}
            disabled={disabled} onChange={e => { setQuantity(e.target.value); setError(""); }}
            onBlur={() => void updateQuantity(quantity)} />
          <button type="button" className="cart-quantity-step" aria-label={`Tăng số lượng ${item.name}`}
            onPointerDown={e => e.preventDefault()}
            disabled={disabled || Number(quantity) >= 10000} onClick={() => stepQuantity(1)}>+</button>
        </div>
      {error && <p className="cart-quantity-error" id={`quantity-error-${item.productId}`} role="alert">{error}</p>}
    </form></td>
    <td data-label="Thành tiền">{formatPrice(item.lineTotal)}</td>
    <td><button className="btn btn-outline" disabled={busy} onClick={() => mutate("delete", `/cart/items/${item.productId}`)}>Bỏ khỏi giỏ</button></td>
  </tr>;
}

export default function Cart() {
  const { cart, cartError, cartLoading, cartBusy, mutateCart, refreshCart } = useCommerce();
  const [drafts, setDrafts] = useState({});
  const [checkoutLocked, setCheckoutLocked] = useState(false);
  // A changed server quantity supersedes its draft; never calculate money from drafts.
  const quantityFor = item => drafts[item.productId]?.base === item.quantity ? drafts[item.productId].value : item.quantity;
  const hasDrafts = cart?.items.some(item => quantityFor(item) === "" || Number(quantityFor(item)) !== item.quantity);
  async function updateItem(item, method, path, body) {
    try {
      return await mutateCart(method, path, body);
    } finally {
      // Discard the manual input on both success and failure; render the server snapshot.
      setDrafts(previous => {
        const next = { ...previous };
        delete next[item.productId];
        return next;
      });
    }
  }
  async function clearCart() {
    if (await mutateCart("delete", "/cart")) setDrafts({});
  }
  return <main className="container commerce-page cart-page"><h1>Giỏ hàng</h1>
    <p>Giá và tồn kho được kiểm tra lại khi đặt hàng. Giỏ hàng chưa giữ chỗ tồn kho.</p>
    {cartError && <p className="notice notice-error" role="alert">{cartError} <button onClick={refreshCart}>Thử lại</button></p>}
    <div className="cart-purchase-layout"><section className="cart-items-panel" aria-label="Sản phẩm trong giỏ">
    {cartLoading ? <p role="status">Đang tải giỏ...</p> : cart && <>
      {cart.items.length === 0 ? <p>Giỏ hàng trống. <Link to="/shop">Khám phá đá quý</Link></p> : <>
        <div className="table-scroll"><table className="shop-table cart-items-table"><thead><tr><th>Sản phẩm</th><th>Đơn giá</th><th>Số lượng</th><th>Thành tiền</th><th>Thao tác</th></tr></thead>
          <tbody>{cart.items.map(item => <CartRow key={item.productId} item={item} busy={cartBusy || checkoutLocked} mutate={(...args) => updateItem(item, ...args)}
            quantity={quantityFor(item)} setQuantity={value => setDrafts(previous => ({ ...previous, [item.productId]: { base: item.quantity, value } }))} />)}</tbody></table></div>
        <div className="commerce-actions"><button className="btn btn-outline" disabled={cartBusy || checkoutLocked} onClick={clearCart}>Xóa toàn bộ giỏ</button></div>
      </>}
    </>}</section>
    <CheckoutSummary blocked={Boolean(hasDrafts || cartError || cart?.items.some(i => !i.isActive || i.quantity > i.stock))} onLockChange={setCheckoutLocked} />
    </div>
  </main>;
}
