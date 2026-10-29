import { Link, NavLink, Navigate } from "react-router-dom";
import LogoutButton from "./LogoutButton";

function AdminRoute({ children }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (role !== "Admin") {
    return <Navigate to="/" replace />;
  }

  return <div className="admin-shell">
    <header className="admin-header"><Link className="admin-brand" to="/">Gem Aurelia <span>Quản trị</span></Link>
      <div className="admin-account"><Link to="/account">Tài khoản</Link><LogoutButton /></div>
    </header>
    <nav className="admin-nav" aria-label="Quản trị">
      <NavLink to="/admin/dashboard">Tổng quan</NavLink>
      <NavLink to="/admin/products">Sản phẩm</NavLink>
      <NavLink to="/admin/categories">Danh mục</NavLink>
      <NavLink to="/admin/customers">Khách hàng</NavLink>
      <NavLink to="/admin/orders">Đơn hàng</NavLink>
      <NavLink to="/admin/reviews">Đánh giá & Hỏi đáp</NavLink>
      <Link to="/">Về cửa hàng ↗</Link>
    </nav>
    {children}
  </div>;
}

export default AdminRoute;
