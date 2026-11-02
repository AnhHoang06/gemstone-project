import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import useOrdersData from "../commerce/useOrdersData";
import { formatPrice } from "../utils/formatPrice";
import "../styles/cart-checkout.css";
import api from "../api/api";
import { apiError, getSessionToken } from "../auth/session";
import { useCommerce } from "../commerce/context";
import { paymentLabel } from "../commerce/paymentStatus";
import OrderStatusBadge from "../commerce/OrderStatusBadge";

export default function Payment() {
  const { id } = useParams();
  return <PaymentView key={id} id={id} />;
}

function PaymentView({ id }) {
  const { data, loading, refreshing, error, refresh } = useOrdersData(`/orders/${id}/payment`);
  const { token } = useCommerce();
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState("");
  const submitting = useRef(false);
  async function report() {
    if (submitting.current) return;
    submitting.current = true; setReporting(true); setReportError("");
    try {
      await api.post(`/orders/${id}/payment-reported`);
      if (token === getSessionToken()) refresh();
    } catch (err) {
      if (token === getSessionToken()) {
        setReportError(apiError(err, "Không gửi được thông báo chuyển khoản. Vui lòng thử lại."));
        refresh();
      }
    } finally { submitting.current = false; setReporting(false); }
  }
  const order = data?.order;
  const canTransfer = order?.paymentMethod === "BankTransfer" && order?.paymentStatus === "Unpaid" && order?.status === "Pending";
  return <main className="container commerce-page"><section className="cart-order-summary payment-panel">
    <h1>Thanh toán đơn hàng #{id}</h1>
    {loading ? <p role="status">Đang tải thông tin thanh toán...</p> : error ? <p className="notice notice-error" role="alert">{error}</p> : order && <>
      <p>Tổng tiền <strong>{formatPrice(order.totalAmount)}</strong></p>
      <OrderStatusBadge status={order.status} />
      <p>Thanh toán: {paymentLabel(order)}</p>
      {order.paymentStatus === "Paid" && order.status === "Confirmed" && <p className="notice" role="status">Đã thanh toán - Đơn đã được xác nhận</p>}
      {order.paymentReportedAt && canTransfer && <p className="notice" role="status">Đã báo chuyển khoản - Đang chờ cửa hàng xác nhận thanh toán</p>}
      {reportError && <p className="notice notice-error" role="alert">{reportError}</p>}
      {order.status === "Cancelled" ? <p className="notice">Đơn đã hủy. Vui lòng không chuyển khoản cho đơn này.</p> :
        order.paymentMethod !== "BankTransfer" ? <p>Đơn này không sử dụng chuyển khoản ngân hàng.</p> :
        canTransfer && (data.bankConfigured ? <>
          <h2>Thông tin chuyển khoản</h2>
          {data.qrImage && <img className="payment-qr" src={data.qrImage} width="264" height="264" alt={`QR chuyển khoản đơn DH${id}, số tiền ${formatPrice(order.totalAmount)}`} />}
          {data.qrError && <p className="notice notice-error" role="alert">{data.qrError}</p>}<dl className="payment-bank">
            <dt>Ngân hàng</dt><dd>{data.bankName}</dd><dt>Số tài khoản</dt><dd>{data.accountNumber}</dd>
            <dt>Chủ tài khoản</dt><dd>{data.accountHolder}</dd><dt>Nội dung</dt><dd><strong>{data.transferContent}</strong></dd>
          </dl>
          <p className="cart-helper">Chuyển đúng số tiền và nội dung trên. Thanh toán cần được cửa hàng kiểm tra; nút bên dưới không xác nhận tiền đã nhận.</p>
          {!order.paymentReportedAt && <button className="btn btn-gold" disabled={reporting || refreshing} onClick={report}>{reporting ? "Đang gửi..." : "Tôi đã chuyển khoản"}</button>}
        </> : <p className="notice" role="status">Chưa có thông tin ngân hàng được cấu hình. Vui lòng chưa chuyển khoản và kiểm tra lại sau.</p>)}
    </>}
    <div className="commerce-actions"><button className="btn btn-outline" disabled={loading || refreshing || reporting} onClick={refresh}>Kiểm tra lại</button>
      <Link to={`/orders/${id}`} className="btn btn-outline">Xem đơn hàng</Link></div>
  </section></main>;
}
