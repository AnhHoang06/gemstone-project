import { Link } from 'react-router-dom';
export default function PlaceholderPage({ title }) {
  return <div className="store-container placeholder-page"><h1>{title}</h1><p>Nội dung đang được cập nhật.</p><Link className="btn btn-gold" to="/shop">Khám phá bộ sưu tập</Link><Link className="btn btn-outline" to="/">Về trang chủ</Link></div>;
}
