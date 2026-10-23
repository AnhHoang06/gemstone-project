import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useOrdersData from "./useOrdersData";
import { useCommerce } from "./context";
import { orderLabels } from "./orderStatus";
import { formatPrice } from "../utils/formatPrice";
import { apiError, getSessionToken } from "../auth/session";
import { cancelCustomerOrder } from "./orderActions";
import CancelOrderDialog from "./CancelOrderDialog";

export default function OrderListView({ admin = false }) {
  const navigate = useNavigate();
  const orderPath = id => `${admin ? "/admin" : ""}/orders/${id}`;
  const [status, setStatus] = useState("");
  const { token, connectionState, refreshCart } = useCommerce();
  const { data, error, loading, refresh } = useOrdersData(admin ? `/orders/admin?status=${encodeURIComponent(status)}` : "/orders");
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
    <p role="status">Cập nhật trực tiếp: {connectionState}</p>
    <div className="commerce-actions">{admin && <label>Trạng thái <select value={status} onChange={e => setStatus(e.target.value)}>
      <option value="">Tất cả</option>{Object.entries(orderLabels).map(([key, value]) => <option value={key} key={key}>{value}</option>)}</select></label>}
      <button className="btn btn-outline" onClick={refresh} disabled={loading}>Tải lại</button></div>
    {loading ? <p role="status">Đang tải đơn hàng...</p> : error ? <p role="alert" className="notice notice-error">{error}</p> : data?.length === 0 ?
      <p>Chưa có đơn hàng phù hợp.</p> : data && <div className="table-scroll"><table className="shop-table"><thead><tr>
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
          <td>{formatPrice(order.totalAmount)}</td><td>{orderLabels[order.status] || order.status}</td>
          {!admin && <td>{order.status === "Pending" && <button className="btn btn-outline" disabled={saving}
            onClick={() => { setActionError(""); setPendingCancel(order.id); }}>Hủy đơn</button>}</td>}</tr>)}
      </tbody></table></div>}
    {pendingCancel !== null && <CancelOrderDialog orderId={pendingCancel} saving={saving} error={actionError}
      fallbackFocus={headingRef} onClose={() => { if (!submitting.current) setPendingCancel(null); }} onConfirm={cancel} />}
  </main>;
}
