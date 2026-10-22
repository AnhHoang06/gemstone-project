import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/api";
import { apiError, getSessionToken } from "../auth/session";
import { useCommerce } from "./context";
import useOrdersData from "./useOrdersData";
import { adminNextStatuses, orderLabels } from "./orderStatus";
import { formatPrice } from "../utils/formatPrice";

export default function OrderDetailView({ admin = false }) {
  const { id } = useParams();
  const { token, connectionState, refreshCart } = useCommerce();
  const { data: order, error, loading, refresh } = useOrdersData(`/orders/${admin ? "admin/" : ""}${id}`);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const submitting = useRef(false);
  async function change(status) {
    if (submitting.current) return;
    submitting.current = true; setSaving(true); setActionError("");
    try {
      await api.put(admin ? `/orders/admin/${id}/status` : `/orders/${id}/cancel`, admin ? { status } : undefined);
      if (token !== getSessionToken()) return;
      setConfirmCancel(false); refresh(); void refreshCart();
    } catch (err) {
      if (token === getSessionToken()) { setActionError(apiError(err, "Không cập nhật được đơn hàng. Hãy tải lại trước khi thử lại.")); refresh(); }
    } finally { submitting.current = false; setSaving(false); }
  }
  const actions = order ? (admin ? adminNextStatuses[order.status] || [] : order.status === "Pending" ? ["Cancelled"] : []) : [];
  return <main className={admin ? "admin-page" : "container commerce-page"}>
    <Link to={admin ? "/admin/orders" : "/orders"}>← Danh sách đơn hàng</Link><h1>Đơn hàng #{id}</h1>
    <p role="status">Cập nhật trực tiếp: {connectionState}</p><button className="btn btn-outline" disabled={loading || saving} onClick={refresh}>Tải lại</button>
    {actionError && <p role="alert" className="notice notice-error">{actionError}</p>}
    {loading ? <p role="status">Đang tải...</p> : error ? <p role="alert" className="notice notice-error">{error}</p> : order && <>
      <p><strong>{orderLabels[order.status] || order.status}</strong> · {new Date(order.createdAt).toLocaleString("vi-VN")}</p>
      <p>{order.recipientName} · {order.recipientPhone}</p><p>{order.shippingAddress}</p>{order.note && <p>Ghi chú: {order.note}</p>}
      <div className="table-scroll"><table className="shop-table"><thead><tr><th>Sản phẩm</th><th>Số lượng</th><th>Đơn giá lúc đặt</th><th>Thành tiền</th></tr></thead>
        <tbody>{order.items.map(i => <tr key={i.productId}><td>{i.productName}</td><td>{i.quantity}</td><td>{formatPrice(i.unitPrice)}</td><td>{formatPrice(i.lineTotal)}</td></tr>)}</tbody></table></div>
      <p><strong>Tổng: {formatPrice(order.totalAmount)}</strong></p>
      <div className="commerce-actions">{actions.map(status => <button className="btn btn-outline" key={status} disabled={saving}
        onClick={() => status === "Cancelled" ? setConfirmCancel(true) : change(status)}>{saving ? "Đang cập nhật..." : status === "Cancelled" ? "Hủy đơn" : `Chuyển: ${orderLabels[status]}`}</button>)}</div>
      {confirmCancel && actions.includes("Cancelled") && <div className="notice" role="group" aria-label="Xác nhận hủy đơn">
        <p>Hủy đơn này? Sản phẩm sẽ được hoàn lại tồn kho.</p><button className="btn btn-danger" disabled={saving} onClick={() => change("Cancelled")}>Xác nhận hủy</button>
        <button className="btn btn-outline" disabled={saving} onClick={() => setConfirmCancel(false)}>Giữ đơn</button></div>}
    </>}
  </main>;
}
