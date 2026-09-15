import { NavLink, Link } from "react-router-dom";
import logo from "../assets/logo-mark.svg";

const navItems = [
  { to: "/", label: "Trang chủ" },
  { to: "/shop", label: "Đá quý" },
  { to: "/wishlist", label: "Yêu thích" },
  { to: "/cart", label: "Giỏ hàng" },
  { to: "/checkout", label: "Thanh toán" },
  { to: "/account", label: "Tài khoản" },
];

function Header() {
  return (
    <>
      <div className="luxury-topbar">
        <div className="container-fluid px-4">
          <span>Tuyển chọn đá quý cao cấp theo tiêu chuẩn sưu tầm</span>
          <span>Tư vấn riêng: +84 900 800 100</span>
        </div>
      </div>
      <header className="main-header">
        <nav className="navbar navbar-expand-lg bg-white luxury-navbar">
          <div className="container">
            <Link className="navbar-brand" to="/">
              <img src={logo} alt="Gem Aurelia" />
            </Link>
            <button
              className="navbar-toggler"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#main-navigation"
              aria-controls="main-navigation"
              aria-expanded="false"
              aria-label="Toggle navigation"
            >
              <span className="navbar-toggler-icon" />
            </button>
            <div className="collapse navbar-collapse" id="main-navigation">
              <ul className="navbar-nav ms-auto align-items-lg-center">
                {navItems.map((item) => (
                  <li className="nav-item" key={item.to}>
                    <NavLink className="nav-link" to={item.to} end={item.to === "/"}>
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </nav>
      </header>
    </>
  );
}

export default Header;
