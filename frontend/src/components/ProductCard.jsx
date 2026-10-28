import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/formatPrice';
import { resolveImageUrl } from '../api/api';
import AddToCartButton from './AddToCartButton';
import FavoriteToggle from './FavoriteToggle';
import ProductPlaceholder from './ProductPlaceholder';
export default function ProductCard({ product, allowCart = true, detailPath = `/product/${product.id}` }) {
  const authority = product.certificateAuthority || product.certificate?.authority;
  return <article className="product-card">
    <Link className="product-card__media" to={detailPath} aria-label={`Xem chi tiết ${product.name}`}>
      {product.imageUrl ? <img src={resolveImageUrl(product.imageUrl)} alt={product.name} loading="lazy" decoding="async" /> : <ProductPlaceholder />}
    </Link><div className="product-card__favorite"><FavoriteToggle product={product} /></div>
    <div className="product-card__body"><div className="product-card__meta"><span>{product.categoryName || product.type}</span>{product.carat != null && <span>{product.carat} ct</span>}</div>
      <h3><Link to={detailPath}>{product.name}</Link></h3>
      <p className="product-card__provenance">{product.origin && <span>Nguồn gốc: {product.origin}</span>}{authority && <span>Kiểm định: {authority}</span>}</p>
      {product.stock === 0 && <span className="product-stock-label">Hết hàng</span>}
      <div className="product-card__footer"><strong>{formatPrice(product.price)}</strong><div className="product-card__actions"><Link className="btn btn-sm btn-outline-dark" to={detailPath}>Xem chi tiết</Link>{allowCart && <AddToCartButton product={product} />}</div></div>
    </div></article>;
}
