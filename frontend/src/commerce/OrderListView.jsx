import { useState } from "react";
import { Link } from "react-router-dom";
import useOrdersData from "./useOrdersData";
import { useCommerce } from "./context";
import { orderLabels } from "./orderStatus";
import { formatPrice } from "../utils/formatPrice";

export default function OrderListView({ admin = false }) {
  const [status, setStatus] = useState("");
  const { connectionState } = useCommerce();
  const { data, error, loading, refresh } = useOrdersData(admin ? `/orders/admin?status=${encodeURIComponent(status)}` : "/orders");
  return <main className={admin ? "admin-page" : "container commerce-page"}>
    <h1>{admin ? "Quản lý đơn hàng" : "Đơn hàng của tôi"}</h1>
    <p role="status">Cập nhật trực tiếp: {connectionState}</p>
    <div className="commerce-actions">{admin && <label>Trạng thái <select value={status} onChange={e => setStatus(e.target.value)}>
      <option value="">Tất cả</option>{Object.entries(orderLabels).map(([key, value]) => <option value={key} key={key}>{value}</option>)}</select></label>}
      <button className="btn btn-outline" onClick={refresh} disabled={loading}>Tải lại</button></div>
    {loading ? <p role="status">Đang tải đơn hàng...</p> : error ? <p role="alert" className="notice notice-error">{error}</p> : data?.length === 0 ?
      <p>Chưa có đơn hàng phù hợp.</p> : data && <div className="table-scroll"><table className="shop-table"><thead><tr>
        <th>Mã đơn</th><th>Người nhận</th><th>Ngày đặt</th><th>Tổng tiền</th><th>Trạng thái</th></tr></thead><tbody>
        {data.map(order => <tr key={order.id}><td><Link to={`${admin ? "/admin" : ""}/orders/${order.id}`}>#{order.id}</Link></td>
          <td>{order.recipientName}</td><td>{new Date(order.createdAt).toLocaleString("vi-VN")}</td>
          <td>{formatPrice(order.totalAmount)}</td><td>{orderLabels[order.status] || order.status}</td></tr>)}
      </tbody></table></div>}
  </main>;
}
