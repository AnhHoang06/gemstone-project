import { Link } from "react-router-dom";
import { cartItems } from "../data/products";
import { formatPrice } from "../utils/formatPrice";

function Cart() {
  // TODO: Replace mock cart items with the real cart source when backend integration is ready.
  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <>
      <section className="page-title">
        <div className="container">
          <h1>Giỏ hàng</h1>
          <p>Các viên đá đang được giữ tạm bằng dữ liệu minh họa, chưa nối giỏ hàng backend.</p>
        </div>
      </section>
      <section className="table-section">
        <div className="container">
          <div className="table-responsive">
            <table className="shop-table">
              <thead>
                <tr>
                  <th>Đá quý</th>
                  <th>Loại</th>
                  <th>Giá</th>
                  <th>SL</th>
                  <th>Tổng</th>
                </tr>
              </thead>
              <tbody>
                {cartItems.map(({ product, quantity }) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{product.type}</td>
                    <td>{formatPrice(product.price)}</td>
                    <td>{quantity}</td>
                    <td>{formatPrice(product.price * quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <aside className="summary-box">
            <span>Tạm tính</span>
            <strong>{formatPrice(subtotal)}</strong>
            <p>Dữ liệu giỏ hàng hiện là mock data trong frontend.</p>
            <Link className="btn btn-gold" to="/checkout">Tiến hành thanh toán</Link>
          </aside>
        </div>
      </section>
    </>
  );
}

export default Cart;
