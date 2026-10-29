import { useId } from 'react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/formatPrice';
import { getProductSpecs } from '../utils/productSpecs';
import { resolveImageUrl } from '../api/api';
import useSpecReveal from '../hooks/useSpecReveal';
import AddToCartButton from './AddToCartButton';
import FavoriteToggle from './FavoriteToggle';
import { InfoIcon } from './Icons';
import ProductPlaceholder from './ProductPlaceholder';

/**
 * variant "compact" = home featured card (image, uppercase name, one outline cart button);
 * variant "catalog" = /shop and /wishlist card (provenance, price, split "Xem chi tiết | Thêm vào giỏ" pill).
 * Both variants share the image block with the spec overlay (hover / keyboard focus / touch toggle).
 */
export default function ProductCard({ product, allowCart = true, detailPath = `/product/${product.id}`, variant = 'catalog' }) {
  const authority = product.certificateAuthority || product.certificate?.authority;
  const specs = getProductSpecs(product);
  const { visible, pinned, toggle, toggleRef, cardProps } = useSpecReveal();
  const panelId = useId();
  const className = `product-card product-card--${variant === 'compact' ? 'compact' : 'catalog'}${visible ? ' is-specs-visible' : ''}${pinned ? ' is-specs-pinned' : ''}`;

  // The panel stays in the DOM (hidden with opacity only) so screen readers can read the specs without hovering.
  const visual = <div className="product-card__visual">
    <Link className="product-card__media" to={detailPath} aria-label={`Xem chi tiết ${product.name}`} tabIndex={-1}>
      {product.imageUrl ? <img src={resolveImageUrl(product.imageUrl)} alt={product.name} loading="lazy" decoding="async" /> : <ProductPlaceholder />}
    </Link>
    <div className="product-card__specs" id={panelId} role="group" aria-label={`Thông số ${product.name}`}>
      <span className="product-card__specs-title" aria-hidden="true">Thông số</span>
      {specs.length ? <dl>{specs.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        : <span className="product-card__specs-empty">Chưa có thông số</span>}
    </div>
    <button type="button" ref={toggleRef} className="product-card__specs-toggle" onClick={toggle}
      aria-label={`Thông số ${product.name}`} aria-expanded={visible} aria-controls={visible ? panelId : undefined}>
      <InfoIcon /><span aria-hidden="true">Thông số</span>
    </button>
    <div className="product-card__favorite"><FavoriteToggle product={product} /></div>
  </div>;

  if (variant === 'compact') return <article className={className} {...cardProps}>
    {visual}
    <div className="product-card__body">
      <h3><Link to={detailPath}>{product.name}</Link></h3>
      {allowCart && <AddToCartButton product={product} className="btn card-outline-button" label="Thêm vào giỏ" />}
    </div>
  </article>;
  return <article className={className} {...cardProps}>
    {visual}
    <div className="product-card__body">
      <h3><Link to={detailPath}>{product.name}</Link>{product.carat != null && <small className="product-card__carat"> {product.carat} ct</small>}</h3>
      {(product.origin || authority) && <p className="product-card__provenance">
        {product.origin && <span>Nguồn gốc: {product.origin}</span>}{product.origin && authority && ' / '}{authority && <span>Kiểm định: {authority}</span>}
      </p>}
      <div className="product-card__footer">
        <strong className="product-card__price">{formatPrice(product.price)}</strong>
        {product.stock > 0 && product.stock <= 3 && <span className="product-stock-label">Còn {product.stock} sản phẩm</span>}
        {product.stock === 0 && <span className="product-stock-label">Hết hàng</span>}
      </div>
      <div className={`card-split-actions${allowCart ? '' : ' is-single'}`}>
        <Link to={detailPath}>Xem chi tiết</Link>
        {allowCart && <AddToCartButton product={product} className="card-split-cart" label="Thêm vào giỏ" wrapperClassName="card-split-cart-wrap" />}
      </div>
    </div>
  </article>;
}
