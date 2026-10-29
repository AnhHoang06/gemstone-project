import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/formatPrice';
import { resolveImageUrl } from '../api/api';
import AddToCartButton from './AddToCartButton';
import FavoriteToggle from './FavoriteToggle';
import ProductPlaceholder from './ProductPlaceholder';

/**
 * variant "compact" = home featured card (image, uppercase name, one outline cart button);
 * variant "catalog" = /shop and /wishlist card (provenance, price, split "Xem chi tiết | Thêm vào giỏ" pill).
 */
export default function ProductCard({ product, allowCart = true, detailPath = `/product/${product.id}`, variant = 'catalog' }) {
  const authority = product.certificateAuthority || product.certificate?.authority;
  const media = <>
    <Link className="product-card__media" to={detailPath} aria-label={`Xem chi tiết ${product.name}`} tabIndex={-1}>
      {product.imageUrl ? <img src={resolveImageUrl(product.imageUrl)} alt={product.name} loading="lazy" decoding="async" /> : <ProductPlaceholder />}
    </Link>
    <div className="product-card__favorite"><FavoriteToggle product={product} /></div>
  </>;
  if (variant === 'compact') return <article className="product-card product-card--compact">
    {media}
    <div className="product-card__body">
      <h3><Link to={detailPath}>{product.name}</Link></h3>
      {allowCart && <AddToCartButton product={product} className="btn card-outline-button" label="Thêm vào giỏ" />}
    </div>
  </article>;
  return <article className="product-card product-card--catalog">
    {media}
    <div className="product-card__body">
      <h3><Link to={detailPath}>{product.name}</Link>{product.carat != null && <small className="product-card__carat"> {product.carat} ct</small>}</h3>
      {(product.origin || authority) && <p className="product-card__provenance">
        {product.origin && <span>Nguồn gốc: {product.origin}</span>}{product.origin && authority && ' / '}{authority && <span>Kiểm định: {authority}</span>}
      </p>}
      <div className="product-card__footer">
        <strong className="product-card__price">{formatPrice(product.price)}</strong>
        {product.stock === 0 && <span className="product-stock-label">Hết hàng</span>}
      </div>
      <div className={`card-split-actions${allowCart ? '' : ' is-single'}`}>
        <Link to={detailPath}>Xem chi tiết</Link>
        {allowCart && <AddToCartButton product={product} className="card-split-cart" label="Thêm vào giỏ" wrapperClassName="card-split-cart-wrap" />}
      </div>
    </div>
  </article>;
}
