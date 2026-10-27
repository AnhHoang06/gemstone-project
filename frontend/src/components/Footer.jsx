import { Link } from "react-router-dom";
import useApiData from "../hooks/useApiData";

function Footer() {
  const { data: categories, loading, error } = useApiData("/categories");
  return (
    <footer className="luxury-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <h2>Gem Aurelia</h2>
            <p>
              Điểm đến tuyển chọn Ruby, Sapphire, Emerald, Diamond và các dòng đá màu hiếm với thông tin xuất xứ,
              chứng nhận và tiêu chuẩn thẩm định rõ ràng.
            </p>
          </div>
          <div className="footer-categories">
            <h3>Bộ sưu tập</h3>
            {loading && <p>Đang tải danh mục...</p>}
            {error && <p role="alert">{error}</p>}
            {categories?.map((category) => <Link key={category.id} to={`/shop?category=${encodeURIComponent(category.name.toLowerCase())}`}>{category.name}</Link>)}
            {categories?.length === 0 && <p>Chưa có danh mục.</p>}
          </div>
          <div className="footer-support">
            <h3>Chăm sóc khách hàng</h3>
            <Link to="/account">Tài khoản của bạn</Link>
            <Link to="/orders">Theo dõi đơn hàng</Link>
            <Link to="/cart">Giỏ hàng</Link>
          </div>
          <div><h3>Kết nối</h3><p>Thông tin liên hệ chính thức sẽ được cập nhật tại đây.</p><Link to="/wishlist">Danh sách yêu thích</Link><Link to="/shop">Khám phá bộ sưu tập</Link></div>
        </div>
        <div className="footer-bottom">Gem Aurelia <span>Vẻ đẹp từ những viên đá quý</span></div>
      </div>
    </footer>
  );
}

export default Footer;
