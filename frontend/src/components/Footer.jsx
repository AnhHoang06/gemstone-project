import { Link } from 'react-router-dom';
import { site } from '../config/site';
export default function Footer() {
  return <footer className="store-footer"><div className="store-container"><div className="store-footer-grid">
    <section><h2>Gem Aurelia</h2><h3>Thông tin liên hệ</h3>{site.address && <p>{site.address}</p>}{site.phone && <a href={`tel:${site.phone}`}>{site.phone}</a>}{site.email && <a href={`mailto:${site.email}`}>{site.email}</a>}</section>
    <section><h3>Liên kết</h3><Link to="/kien-thuc">Kiến thức</Link><Link to="/lien-he">Liên hệ</Link><Link to="/hen-lich">Hẹn lịch</Link><Link to="/shop">Bộ sưu tập</Link></section>
    <section><h3>Chăm sóc khách hàng</h3><Link to="/account">Tài khoản</Link><Link to="/orders">Đơn hàng</Link><Link to="/cart">Giỏ hàng</Link><Link to="/wishlist">Yêu thích</Link><Link to="/ho-tro">Hỗ trợ</Link></section>
    {site.socialLinks.length > 0 && <section><h3>Mạng xã hội</h3>{site.socialLinks.map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>)}</section>}
    </div><div className="store-footer-bottom"><span>Gem Aurelia · Vẻ đẹp trong từng sắc đá</span><span>Thanh toán khi nhận hàng (COD) · Chuyển khoản ngân hàng</span></div></div></footer>;
}
