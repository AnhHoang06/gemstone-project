import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import useOrdersData from "../commerce/useOrdersData";
import { formatPrice } from "../utils/formatPrice";
import "../styles/cart-checkout.css";

export default function Payment() {
  const { id } = useParams();
  return <PaymentView key={id} id={id} />;
}

function PaymentView({ id }) {
  const { data, loading, refreshing, error, refresh } = useOrdersData(`/orders/${id}/payment`);
  const [reported, setReported] = useState(false);
  const order = data?.order;
  const canTransfer = order?.paymentMethod === "BankTransfer" && order?.paymentStatus === "Unpaid" && order?.status !== "Cancelled";
  return <main className="container commerce-page"><section className="cart-order-summary payment-panel">
    <h1>Thanh toán đơn hàng #{id}</h1>
    {loading ? <p role="status">Đang tải thông tin thanh toán...</p> : error ? <p className="notice notice-error" role="alert">{error}</p> : order && <>
      <p>Tổng tiền <strong>{formatPrice(order.totalAmount)}</strong></p>
      <p>Thanh toán: {order.paymentStatus === "Paid" ? "Đã thanh toán" : order.paymentStatus === "Unpaid" ? "Chưa thanh toán" : "Chưa có thông tin"}</p>
      {order.status === "Cancelled" ? <p className="notice">Đơn đã hủy. Vui lòng không chuyển khoản cho đơn này.</p> :
        order.paymentMethod !== "BankTransfer" ? <p>Đơn này không sử dụng chuyển khoản ngân hàng.</p> :
        canTransfer && (data.bankConfigured ? <>
          <h2>Thông tin chuyển khoản</h2><dl className="payment-bank">
            <dt>Ngân hàng</dt><dd>{data.bankName}</dd><dt>Số tài khoản</dt><dd>{data.accountNumber}</dd>
            <dt>Chủ tài khoản</dt><dd>{data.accountHolder}</dd><dt>Nội dung</dt><dd><strong>{data.transferContent}</strong></dd>
          </dl>
          <p className="cart-helper">Chuyển đúng số tiền và nội dung trên. Thanh toán cần được cửa hàng kiểm tra; nút bên dưới không xác nhận tiền đã nhận.</p>
          <button className="btn btn-gold" disabled={reported || refreshing} onClick={() => setReported(true)}>Tôi đã chuyển khoản</button>
          {reported && <p className="notice" role="status">Đơn chưa được đánh dấu đã thanh toán. Chưa có chức năng gửi xác nhận chuyển khoản; vui lòng chờ cửa hàng đối soát.</p>}
        </> : <p className="notice" role="status">Chưa có thông tin ngân hàng được cấu hình. Vui lòng chưa chuyển khoản và kiểm tra lại sau.</p>)}
    </>}
    <div className="commerce-actions"><button className="btn btn-outline" disabled={loading || refreshing} onClick={refresh}>Kiểm tra lại</button>
      <Link to={`/orders/${id}`} className="btn btn-outline">Xem đơn hàng</Link></div>
  </section></main>;
}
