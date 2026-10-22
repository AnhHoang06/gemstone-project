import { useEffect, useRef, useState } from "react";
import api from "../../api/api";
import { apiError } from "../../auth/session";
import "../../styles/admin.css";

export default function AdminCustomers() {
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState(null);
  const submitting = useRef(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/users"), api.get("/users/me")])
      .then(([list, me]) => {
        if (!active) return;
        setUsers(list.data);
        setCurrentUserId(me.data.id);
        setLoaded(true);
      })
      .catch((err) => {
        if (active) setError(apiError(err, "Không thể tải danh sách tài khoản."));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  function retry() {
    setError("");
    setLoading(true);
    setAttempt((value) => value + 1);
  }

  async function toggleStatus(user) {
    if (submitting.current || user.id === currentUserId) return;
    if (user.isActive && !window.confirm(`Khóa tài khoản ${user.email}?`)) return;
    submitting.current = true;
    setPendingId(user.id);
    setError("");
    try {
      const response = await api.put(`/users/${user.id}/status`, { isActive: !user.isActive });
      setUsers((previous) => previous.map((item) => item.id === user.id ? response.data : item));
    } catch (err) {
      setError(apiError(err, "Không thể cập nhật trạng thái tài khoản. Vui lòng thử lại."));
    } finally {
      submitting.current = false;
      setPendingId(null);
    }
  }

  return <main className="admin-page">
    <h1>Quản lý tài khoản khách hàng</h1>
    <p>Danh sách bao gồm Admin và Customer. Vai trò chỉ để xem.</p>
    <p>Khóa tài khoản chặn đăng nhập mới và từ chối phiên hiện tại ở yêu cầu API tiếp theo.</p>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {loading ? <p role="status">Đang tải...</p> : !loaded ?
      <button type="button" onClick={retry}>Thử lại</button> : users.length === 0 ?
        <p>Chưa có tài khoản nào.</p> :
        <div className="table-scroll" tabIndex={0} aria-label="Danh sách khách hàng">
          <table className="admin-table">
            <thead><tr><th>Họ tên</th><th>Email</th><th>Điện thoại</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>{users.map((user) => <tr key={user.id}>
              <td>{user.fullName}</td><td>{user.email}</td><td>{user.phone || "—"}</td><td>{user.role}</td>
              <td><span className={user.isActive ? "badge badge-active" : "badge badge-inactive"}>{user.isActive ? "Hoạt động" : "Đã khóa"}</span></td>
              <td>{user.id === currentUserId ? <span>Tài khoản của bạn</span> :
                <button type="button" className="btn btn-sm btn-outline" disabled={pendingId !== null}
                  onClick={() => toggleStatus(user)}>
                  {pendingId === user.id ? "Đang lưu..." : user.isActive ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                </button>}</td>
            </tr>)}</tbody>
          </table>
        </div>}
  </main>;
}
