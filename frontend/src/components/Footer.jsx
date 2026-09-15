import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="luxury-footer">
      <div className="container">
        <div className="row g-4">
          <div className="col-lg-5">
            <h2>Gem Aurelia</h2>
            <p>
              Điểm đến tuyển chọn Ruby, Sapphire, Emerald, Diamond và các dòng đá màu hiếm với thông tin xuất xứ,
              chứng nhận và tiêu chuẩn thẩm định rõ ràng.
            </p>
          </div>
          <div className="col-sm-6 col-lg-3">
            <h3>Bộ sưu tập</h3>
            <Link to="/shop?category=ruby">Ruby</Link>
            <Link to="/shop?category=sapphire">Sapphire</Link>
            <Link to="/shop?category=emerald">Emerald</Link>
            <Link to="/shop?category=diamond">Diamond</Link>
          </div>
          <div className="col-sm-6 col-lg-4">
            <h3>Chăm sóc khách hàng</h3>
            <p>Showroom Saigon theo lịch hẹn</p>
            <p>care@gemaurelia.example</p>
            <p>Giao hàng bảo hiểm toàn cầu</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
