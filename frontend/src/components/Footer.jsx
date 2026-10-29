import { Link } from 'react-router-dom';
import { site } from '../config/site';

// Columns follow the mockup; a column with no verified data (site.js) is not rendered at all.
export default function Footer() {
  const hasContact = Boolean(site.address || site.phone || site.email);
  const socials = (site.socialLinks || []).filter(link => link?.url && link?.label);
  return <footer className="store-footer"><div className="store-container"><div className="store-footer-grid">
    {hasContact && <section aria-labelledby="footer-contact"><h2 id="footer-contact">Thông tin liên hệ</h2>
      {site.address && <p>{site.address}</p>}{site.phone && <a href={`tel:${site.phone}`}>{site.phone}</a>}{site.email && <a href={`mailto:${site.email}`}>{site.email}</a>}</section>}
    <section aria-labelledby="footer-links"><h2 id="footer-links">Liên kết</h2><Link to="/kien-thuc">Kiến thức</Link><Link to="/lien-he">Liên hệ</Link><Link to="/hen-lich">Hẹn lịch</Link><Link to="/shop">Thế giới đá quý</Link></section>
    <section aria-labelledby="footer-care"><h2 id="footer-care">Chăm sóc khách hàng</h2><Link to="/account">Tài khoản</Link><Link to="/orders">Đơn hàng</Link><Link to="/cart">Giỏ hàng</Link><Link to="/wishlist">Yêu thích</Link><Link to="/ho-tro">Hỗ trợ</Link></section>
    {socials.length > 0 && <section aria-labelledby="footer-social"><h2 id="footer-social">Mạng xã hội</h2>{socials.map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>)}</section>}
  </div><div className="store-footer-bottom"><span>Gem Aurelia</span><span>Thanh toán khi nhận hàng (COD) · Chuyển khoản ngân hàng</span></div></div></footer>;
}
