import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useOrdersData from "./useOrdersData";
import { useCommerce } from "./context";
import { orderLabels } from "./orderStatus";
import { formatPrice } from "../utils/formatPrice";
import { apiError, getSessionToken } from "../auth/session";
import { cancelCustomerOrder } from "./orderActions";
import CancelOrderDialog from "./CancelOrderDialog";
import OrderStatusBadge from "./OrderStatusBadge";

export default function OrderListView({ admin = false }) {
  const navigate = useNavigate();
  const orderPath = id => `${admin ? "/admin" : ""}/orders/${id}`;
  const [status, setStatus] = useState("");
  const { token, connectionState, refreshCart } = useCommerce();
  const { data, error, loading, refreshing, refresh } = useOrdersData(admin ? `/orders/admin?status=${encodeURIComponent(status)}` : "/orders");
  const [pendingCancel, setPendingCancel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const submitting = useRef(false);
  const headingRef = useRef(null);
  async function cancel() {
    if (pendingCancel === null || submitting.current) return;
    submitting.current = true; setSaving(true); setActionError("");
    try {
      await cancelCustomerOrder(pendingCancel);
      if (token !== getSessionToken()) return;
      setPendingCancel(null); refresh(); void refreshCart();
    } catch (err) {
      if (token === getSessionToken()) {
        setActionError(apiError(err, "Không hủy được đơn hàng. Vui lòng tải lại và thử lại."));
        refresh();
      }
    } finally { submitting.current = false; setSaving(false); }
  }
  return <main className={admin ? "admin-page" : "container commerce-page"}>
    <h1 ref={headingRef} tabIndex={-1}>{admin ? "Quản lý đơn hàng" : "Đơn hàng của tôi"}</h1>
    <p className="order-secondary" role="status">Cập nhật trực tiếp: {connectionState}</p>
    <div className="order-toolbar">{admin && <div className="order-filters" role="group" aria-label="Lọc trạng thái đơn hàng">
      {[["", "Tất cả"], ...Object.entries(orderLabels)].map(([key, label]) => <button type="button" key={key}
        aria-pressed={status === key} onClick={() => setStatus(key)}>{label}</button>)}</div>}
      <button className="btn btn-outline" onClick={refresh} disabled={loading || refreshing}>{refreshing ? "Đang cập nhật…" : "Tải lại"}</button></div>
    {error && <p role="alert" className="notice notice-error">{error}</p>}
    {loading ? <p role="status">Đang tải đơn hàng...</p> : !error && data?.length === 0 ?
      <div className="empty-state"><p>Chưa có đơn hàng phù hợp.</p>{!admin && <Link to="/shop">Khám phá đá quý</Link>}</div> : data && !admin ?
      <div className="order-cards" aria-busy={refreshing}>{data.map(order => <article key={order.id} className="order-card" tabIndex={0}
        aria-label={`Mở chi tiết đơn hàng #${order.id}`} aria-keyshortcuts="Enter Space"
        onClick={event => { if (!event.defaultPrevented && !event.target.closest('a, button')) navigate(orderPath(order.id)); }}
        onKeyDown={event => { if (event.target === event.currentTarget && ["Enter", " "].includes(event.key)) { event.preventDefault(); navigate(orderPath(order.id)); } }}>
        <div className="order-card-heading"><div><Link className="order-number" to={orderPath(order.id)}>#{order.id}</Link>
          <p className="order-secondary">{new Date(order.createdAt).toLocaleString("vi-VN")}</p></div><OrderStatusBadge status={order.status} /></div>
        <div className="order-card-body"><div><span className="order-label">Người nhận</span><p>{order.recipientName}</p>
          {order.itemCount != null && <p className="order-secondary">{order.itemCount} sản phẩm</p>}</div>
          <div className="order-card-total"><span className="order-label">Tổng thanh toán</span><strong>{formatPrice(order.totalAmount)}</strong></div></div>
        <div className="order-card-actions"><Link className="btn btn-outline" to={orderPath(order.id)}>Xem chi tiết</Link>
          {order.status === "Pending" && <button className="btn btn-outline order-cancel" disabled={saving}
            onClick={event => { event.stopPropagation(); setActionError(""); setPendingCancel(order.id); }}>Hủy đơn</button>}</div>
      </article>)}</div> : data && <div className="table-scroll" aria-busy={refreshing}><table className="shop-table order-admin-table"><thead><tr>
        <th>Mã đơn</th><th>Người nhận</th><th>Ngày đặt</th><th>Tổng tiền</th><th>Trạng thái</th>{!admin && <th>Thao tác</th>}</tr></thead><tbody>
        {data.map(order => <tr key={order.id} className="order-navigation-row" tabIndex={0}
          aria-label={`Mở chi tiết đơn hàng #${order.id}`} aria-keyshortcuts="Enter Space"
          onClick={event => {
            // Keep nested links and action controls independent of row navigation.
            if (event.defaultPrevented || event.target.closest('a, button, input, select, textarea, label, [role="button"], [role="link"], [contenteditable="true"]')) return;
            navigate(orderPath(order.id));
          }}
          onKeyDown={event => {
            if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
            event.preventDefault();
            navigate(orderPath(order.id));
          }}><td><Link to={orderPath(order.id)}>#{order.id}</Link></td>
          <td>{order.recipientName}</td><td>{new Date(order.createdAt).toLocaleString("vi-VN")}</td>
          <td className="order-money">{formatPrice(order.totalAmount)}</td><td><OrderStatusBadge status={order.status} /></td>
          {!admin && <td>{order.status === "Pending" && <button className="btn btn-outline" disabled={saving}
            onClick={() => { setActionError(""); setPendingCancel(order.id); }}>Hủy đơn</button>}</td>}</tr>)}
      </tbody></table></div>}
    {pendingCancel !== null && <CancelOrderDialog orderId={pendingCancel} saving={saving} error={actionError}
      fallbackFocus={headingRef} onClose={() => { if (!submitting.current) setPendingCancel(null); }} onConfirm={cancel} />}
  </main>;
}
