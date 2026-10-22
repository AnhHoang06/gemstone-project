import { useState } from "react";
import { Link } from "react-router-dom";
import { useCommerce } from "../commerce/context";
import { formatPrice } from "../utils/formatPrice";
import { resolveImageUrl } from "../api/api";

function CartRow({ item, busy, mutate }) {
  const [quantity, setQuantity] = useState(item.quantity);
  return <tr>
    <td>{item.imageUrl && <img className="commerce-thumb" src={resolveImageUrl(item.imageUrl)} alt="" />}
      <Link to={`/product/${item.productId}`}>{item.name}</Link>
      {!item.isActive && <p className="notice-error">Đã ngừng bán</p>}
      {item.quantity > item.stock && <p className="notice-error">Chỉ còn {item.stock} sản phẩm</p>}</td>
    <td>{formatPrice(item.price)}</td>
    <td><form onSubmit={e => { e.preventDefault(); void mutate("put", `/cart/items/${item.productId}`, { quantity: Number(quantity) }); }}>
      <label className="visually-hidden" htmlFor={`quantity-${item.productId}`}>Số lượng {item.name}</label>
      <input id={`quantity-${item.productId}`} type="number" min="1" max="10000" step="1" required value={quantity}
        disabled={busy || !item.isActive} onChange={e => setQuantity(e.target.value)} />
      <button className="btn btn-outline" disabled={busy || !item.isActive}>Cập nhật</button>
    </form></td>
    <td>{formatPrice(item.lineTotal)}</td>
    <td><button className="btn btn-outline" disabled={busy} onClick={() => mutate("delete", `/cart/items/${item.productId}`)}>Bỏ khỏi giỏ</button></td>
  </tr>;
}

export default function Cart() {
  const { cart, cartError, cartLoading, cartBusy, mutateCart, refreshCart } = useCommerce();
  return <main className="container commerce-page"><h1>Giỏ hàng</h1>
    <p>Giá và tồn kho được kiểm tra lại khi đặt hàng. Giỏ hàng chưa giữ chỗ tồn kho.</p>
    {cartError && <p className="notice notice-error" role="alert">{cartError} <button onClick={refreshCart}>Thử lại</button></p>}
    {cartLoading ? <p role="status">Đang tải giỏ...</p> : cart && <>
      {cart.items.length === 0 ? <p>Giỏ hàng trống. <Link to="/shop">Khám phá đá quý</Link></p> : <>
        <div className="table-scroll"><table className="shop-table"><thead><tr><th>Sản phẩm</th><th>Đơn giá</th><th>Số lượng</th><th>Thành tiền</th><th>Thao tác</th></tr></thead>
          <tbody>{cart.items.map(item => <CartRow key={`${item.productId}:${item.quantity}`} item={item} busy={cartBusy} mutate={mutateCart} />)}</tbody></table></div>
        <div className="commerce-actions"><button className="btn btn-outline" disabled={cartBusy} onClick={() => mutateCart("delete", "/cart")}>Xóa toàn bộ giỏ</button>
          <strong>Tổng: {formatPrice(cart.total)}</strong>
          {!cartError && !cartBusy && cart.items.every(i => i.isActive && i.quantity <= i.stock) && <Link className="btn btn-gold" to="/checkout">Đặt hàng</Link>}</div>
      </>}
    </>}
  </main>;
}
