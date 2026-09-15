import { Link } from "react-router-dom";

const formatPrice = (price) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(price);

function ProductCard({ product }) {
  return (
    <article className="product-card">
      <Link
        className="product-card__media"
        to={`/product/${product.id}`}
        style={{ "--gem-color": product.accent }}
        aria-label={`Xem chi tiết ${product.name}`}
      >
        <span className="gem-facet" />
      </Link>
      <div className="product-card__body">
        <div className="product-card__meta">
          <span>{product.type}</span>
          <span>{product.carat} ct</span>
        </div>
        <h3>
          <Link to={`/product/${product.id}`}>{product.name}</Link>
        </h3>
        <p>{product.origin || product.color}</p>
        <div className="product-card__footer">
          <strong>{formatPrice(product.price)}</strong>
          <div className="product-card__actions">
            <Link className="btn btn-sm btn-outline-dark" to={`/product/${product.id}`}>
              Chi tiết
            </Link>
            <button className="btn btn-sm btn-gold" type="button">
              Thêm giỏ
            </button>
            <button className="btn btn-sm btn-ghost" type="button" aria-label={`Thêm ${product.name} vào yêu thích`}>
              Yêu thích
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export { formatPrice };
export default ProductCard;
