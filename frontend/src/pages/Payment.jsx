import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import useOrdersData from "../commerce/useOrdersData";
import { formatPrice } from "../utils/formatPrice";
import "../styles/cart-checkout.css";
import api from "../api/api";
import { apiError, getSessionToken } from "../auth/session";
import { useCommerce } from "../commerce/context";
import { paymentLabel } from "../commerce/paymentStatus";
import OrderStatusBadge from "../commerce/OrderStatusBadge";
import NotificationToast from "../components/NotificationToast";

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
  const copyingRef = useRef(false);
  const active = useRef(true);
  const [copying, setCopying] = useState(false);
  const [copyToast, setCopyToast] = useState(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function copy(value) {
    if (copyingRef.current || token !== getSessionToken()) return;
    copyingRef.current = true; setCopying(true); setCopyToast(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(String(value));
      if (active.current && token === getSessionToken()) setCopyToast({ id: Date.now(), kind: 'success', message: 'Đã sao chép' });
    } catch {
      if (active.current && token === getSessionToken()) setCopyToast({ id: Date.now(), kind: 'error', message: 'Không thể sao chép. Vui lòng chọn và sao chép nội dung thủ công.' });
    } finally {
      copyingRef.current = false;
      if (active.current && token === getSessionToken()) setCopying(false);
    }
  }
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
        order.paymentMethod !== "BankTransfer" ? <p>{order.paymentMethod === "COD" ? "Thanh toán khi nhận hàng (COD)" : "Đơn này không sử dụng chuyển khoản ngân hàng."}</p> :
        canTransfer && (data.bankConfigured ? <>
          <h2>Thông tin chuyển khoản</h2>
          {data.qrImage && <img className="payment-qr" src={data.qrImage} width="264" height="264" alt={`QR chuyển khoản đơn ${data.transferContent}, số tiền ${formatPrice(order.totalAmount)}`} />}
          {data.qrError && <p className="notice notice-error" role="alert">{data.qrError}</p>}<dl className="payment-bank">
            <dt>Ngân hàng</dt><dd>{data.bankName}</dd><dt>Số tài khoản</dt><dd><span>{data.accountNumber}</span><PaymentCopyButton value={data.accountNumber} label="số tài khoản" disabled={copying} onCopy={copy} /></dd>
            <dt>Chủ tài khoản</dt><dd>{data.accountHolder}</dd>
            <dt>Số tiền</dt><dd><span>{formatPrice(order.totalAmount)}</span>{data.transferAmount != null && <PaymentCopyButton value={data.transferAmount} label="số tiền" disabled={copying} onCopy={copy} />}</dd>
            <dt>Nội dung chuyển khoản</dt><dd><strong>{data.transferContent}</strong><PaymentCopyButton value={data.transferContent} label="nội dung chuyển khoản" disabled={copying} onCopy={copy} /></dd>
          </dl>
          <p className="cart-helper">Chuyển đúng số tiền và nội dung trên. Thanh toán cần được cửa hàng kiểm tra; nút bên dưới không xác nhận tiền đã nhận.</p>
          {!order.paymentReportedAt && <button className="btn btn-gold" disabled={reporting || refreshing} onClick={report}>{reporting ? "Đang gửi..." : "Tôi đã chuyển khoản"}</button>}
        </> : <p className="notice" role="status">Thông tin chuyển khoản hiện chưa được cấu hình.</p>)}
    </>}
    <div className="commerce-actions"><button className="btn btn-outline" disabled={loading || refreshing || reporting} onClick={refresh}>Kiểm tra lại</button>
      <Link to={`/orders/${id}`} className="btn btn-outline">Xem đơn hàng</Link></div>
  </section>
    {copyToast && <NotificationToast key={copyToast.id} toast={{ ...copyToast, label: "Thông báo sao chép", actionPath: `/orders/${id}`, actionLabel: "Xem đơn hàng" }} onClose={() => setCopyToast(null)} />}
  </main>;
}

function PaymentCopyButton({ value, label, disabled, onCopy }) {
  return <button type="button" className="btn btn-outline payment-copy" aria-label={`Sao chép ${label}`} disabled={disabled} onClick={() => onCopy(value)}>Sao chép</button>;
}
