import { useEffect, useState } from "react";
import api from "../../api/api";
import { apiError } from "../../auth/session";
import "../../styles/admin.css";
import "../../styles/dashboard.css";

const metrics = [
  ["totalCustomers", "Tổng khách hàng", "Tài khoản có vai trò Customer"],
  ["activeCustomers", "Khách hàng hoạt động", "Tài khoản Customer đang được kích hoạt"],
  ["totalProducts", "Tổng sản phẩm", "Tất cả sản phẩm trong cơ sở dữ liệu"],
  ["activeProducts", "Sản phẩm đang bán", "Sản phẩm có trạng thái hoạt động"],
  ["totalOrders", "Tổng đơn hàng", "Đơn đã lưu, bao gồm mọi trạng thái"],
];

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    api.get("/dashboard/summary")
      .then(({ data }) => { if (active) setSummary(data); })
      .catch((err) => {
        if (active) setError(apiError(err, "Không thể tải tổng quan. Vui lòng thử lại."));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  function refresh() {
    setLoading(true);
    setError("");
    setAttempt((value) => value + 1);
  }

  return <main className="admin-page" aria-busy={loading}>
    <div className="admin-page-heading">
      <div><p className="eyebrow">Gem Aurelia · Quản trị</p><h1>Tổng quan</h1></div>
      <button className="btn btn-outline" type="button" disabled={loading} onClick={refresh}>
        {loading ? "Đang tải..." : error ? "Thử lại" : "Làm mới"}
      </button>
    </div>
    <p>Số liệu trực tiếp từ cơ sở dữ liệu cửa hàng.</p>
    {loading ? <p className="empty-state" role="status">Đang tải số liệu tổng quan...</p> :
      error ? <p className="admin-error" role="alert">{error}</p> : summary &&
        <dl className="dashboard-metrics">
          {metrics.map(([key, label, description]) => <div className="dashboard-metric" key={key}>
            <dt>{label}</dt>
            <dd>{summary[key].toLocaleString("vi-VN")}</dd>
            <dd className="dashboard-metric-note">{description}</dd>
          </div>)}
        </dl>}
    <section className="dashboard-dependency" aria-labelledby="revenue-heading">
      <h2 id="revenue-heading">Doanh thu</h2>
      <p>Chưa khả dụng. Hệ thống chưa xác định quy tắc thanh toán và ghi nhận doanh thu cho đơn hoàn tất.</p>
    </section>
  </main>;
}
