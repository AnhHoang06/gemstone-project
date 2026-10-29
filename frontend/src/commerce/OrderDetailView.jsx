import { OrderReviewLink } from '../engagement/OrderReview';
import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/api";
import { apiError, getSessionToken } from "../auth/session";
import { useCommerce } from "./context";
import useOrdersData from "./useOrdersData";
import { adminNextStatuses, orderLabels } from "./orderStatus";
import { formatPrice } from "../utils/formatPrice";
import { cancelCustomerOrder } from "./orderActions";
import OrderStatusBadge from "./OrderStatusBadge";

export default function OrderDetailView({ admin = false }) {
  const { id } = useParams();
  const { token, connectionState, refreshCart } = useCommerce();
  const { data: order, error, loading, refreshing, refresh } = useOrdersData(`/orders/${admin ? "admin/" : ""}${id}`);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const submitting = useRef(false);
  async function change(status) {
    if (submitting.current) return;
    submitting.current = true; setSaving(true); setActionError("");
    try {
      if (admin) await api.put(`/orders/admin/${id}/status`, { status });
      else await cancelCustomerOrder(id);
      if (token !== getSessionToken()) return;
      setConfirmCancel(false); refresh(); void refreshCart();
    } catch (err) {
      if (token === getSessionToken()) { setActionError(apiError(err, "Không cập nhật được đơn hàng. Hãy tải lại trước khi thử lại.")); refresh(); }
    } finally { submitting.current = false; setSaving(false); }
  }
  const actions = order ? (admin ? adminNextStatuses[order.status] || [] : order.status === "Pending" ? ["Cancelled"] : []) : [];
  return <main className={admin ? "admin-page" : "container commerce-page"}>
    <Link to={admin ? "/admin/orders" : "/orders"}>← Danh sách đơn hàng</Link><h1>Đơn hàng #{id}</h1>
    <p className="order-secondary" role="status">Cập nhật trực tiếp: {connectionState}</p><button className="btn btn-outline" disabled={loading || refreshing || saving} onClick={refresh}>{refreshing ? "Đang cập nhật…" : "Tải lại"}</button>
    {actionError && <p role="alert" className="notice notice-error">{actionError}</p>}
    {error && <p role="alert" className="notice notice-error">{error}</p>}
    {loading ? <p role="status">Đang tải...</p> : order && <>
      <section className="order-detail-summary" aria-label="Tóm tắt đơn hàng"><div><OrderStatusBadge status={order.status} />
        <p className="order-secondary">Đặt ngày {new Date(order.createdAt).toLocaleString("vi-VN")}</p></div>
        <div><span className="order-label">Tổng thanh toán</span><strong>{formatPrice(order.totalAmount)}</strong></div></section>
      {order.status !== "Cancelled" && <ol className="order-progress" aria-label="Tiến trình đơn hàng">
        {["Pending", "Confirmed", "Shipping", "Completed"].map((status, index, steps) => <li key={status}
          className={index <= steps.indexOf(order.status) ? "is-reached" : ""} aria-current={status === order.status ? "step" : undefined}>
          <span aria-hidden="true">{index + 1}</span>{orderLabels[status]}{status === order.status && <small>Hiện tại</small>}</li>)}</ol>}
      <section className="order-shipping"><h2>Thông tin nhận hàng</h2><strong>{order.recipientName}</strong>
        <p>{order.recipientPhone}</p><p>{order.shippingAddress}</p>{order.note && <p className="order-secondary">Ghi chú: {order.note}</p>}</section>
      <section className="order-shipping"><h2>Thanh toán</h2>
        <p>{order.paymentMethod === "COD" ? "Thanh toán khi nhận hàng (COD)" : order.paymentMethod === "BankTransfer" ? "Chuyển khoản ngân hàng" : "Chưa ghi nhận phương thức (đơn cũ)"}</p>
        <p>{order.paymentStatus === "Paid" ? "Đã thanh toán" : order.paymentStatus === "Unpaid" ? "Chưa thanh toán" : "Chưa ghi nhận trạng thái thanh toán"}</p>
        {!admin && order.paymentMethod === "BankTransfer" && order.paymentStatus === "Unpaid" && order.status !== "Cancelled" && <Link to={`/payment/${id}`}>Hướng dẫn chuyển khoản</Link>}
      </section>
      <section className="order-items"><h2>Sản phẩm trong đơn <span className="order-secondary">({order.items.reduce((sum, item) => sum + item.quantity, 0)})</span></h2>
      <div className="table-scroll"><table className="shop-table order-items-table"><thead><tr><th>Sản phẩm</th><th>Số lượng</th><th>Đơn giá lúc đặt</th><th>Thành tiền</th></tr></thead>
        <tbody>{order.items.map(i => <tr key={i.productId}><td>{i.productName}{!admin && order.status === "Completed" && <OrderReviewLink productId={i.productId} />}</td><td>{i.quantity}</td><td>{formatPrice(i.unitPrice)}</td><td>{formatPrice(i.lineTotal)}</td></tr>)}</tbody></table></div>
      <p className="order-detail-total">Tổng: <strong>{formatPrice(order.totalAmount)}</strong></p></section>
      <div className="commerce-actions order-detail-actions">{actions.map(status => <button className="btn btn-outline" key={status} disabled={saving || refreshing}
        onClick={() => status === "Cancelled" ? setConfirmCancel(true) : change(status)}>{saving ? "Đang cập nhật..." : status === "Cancelled" ? "Hủy đơn" : `Chuyển: ${orderLabels[status]}`}</button>)}</div>
      {confirmCancel && actions.includes("Cancelled") && <div className="notice" role="group" aria-label="Xác nhận hủy đơn">
        <p>Hủy đơn này? Sản phẩm sẽ được hoàn lại tồn kho.</p><button className="btn btn-danger" disabled={saving} onClick={() => change("Cancelled")}>Xác nhận hủy</button>
        <button className="btn btn-outline" disabled={saving} onClick={() => setConfirmCancel(false)}>Giữ đơn</button></div>}
    </>}
  </main>;
}
