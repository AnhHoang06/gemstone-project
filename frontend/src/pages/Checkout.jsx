import { cartItems } from "../data/products";
import { formatPrice } from "../components/ProductCard";

function Checkout() {
  // TODO: Connect checkout submission to backend payment flow when API is available.
  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <>
      <section className="page-title">
        <div className="container">
          <h1>Thanh toán</h1>
          <p>Form thanh toán minh họa cho đơn đá quý có bảo hiểm vận chuyển.</p>
        </div>
      </section>
      <section className="checkout-section">
        <div className="container checkout-grid">
          <form className="checkout-form">
            <h2>Thông tin thanh toán</h2>
            <div className="form-row">
              <label>Họ và tên<input type="text" placeholder="Nguyen An" /></label>
              <label>Email<input type="email" placeholder="client@example.com" /></label>
            </div>
            <label>Địa chỉ<input type="text" placeholder="Showroom hoặc địa chỉ giao hàng bảo hiểm" /></label>
            <div className="form-row">
              <label>Thành phố<input type="text" placeholder="Ho Chi Minh City" /></label>
              <label>Quốc gia<input type="text" placeholder="Vietnam" /></label>
            </div>
            <label>Ghi chú<textarea rows="4" placeholder="Yêu cầu lên nhẫn, ngày giao mong muốn hoặc câu hỏi về chứng nhận" /></label>
          </form>
          <aside className="summary-box">
            <h2>Tóm tắt đơn hàng</h2>
            {cartItems.map(({ product, quantity }) => (
              <div className="summary-line" key={product.id}>
                <span>{product.name} x {quantity}</span>
                <strong>{formatPrice(product.price * quantity)}</strong>
              </div>
            ))}
            <div className="summary-line summary-line--total">
              <span>Tổng cộng</span>
              <strong>{formatPrice(subtotal)}</strong>
            </div>
            <p className="mock-note">Chưa gửi dữ liệu thanh toán tới backend.</p>
            <button className="btn btn-gold w-100" type="button">Yêu cầu thanh toán bảo mật</button>
          </aside>
        </div>
      </section>
    </>
  );
}

export default Checkout;
