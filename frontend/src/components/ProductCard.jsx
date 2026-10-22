import { Link } from "react-router-dom";

import { formatPrice } from "../utils/formatPrice";
import { resolveImageUrl } from "../api/api";
import AddToCartButton from "./AddToCartButton";

function ProductCard({ product, allowCart = true }) {
  return (
    <article className="product-card">
      <Link
        className="product-card__media"
        to={`/product/${product.id}`}
        style={{ "--gem-color": product.accent }}
        aria-label={`Xem chi tiết ${product.name}`}
      >
        {product.imageUrl ? <img src={resolveImageUrl(product.imageUrl)} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "contain", position: "relative", zIndex: 1 }} /> : product.accent ? <span className="gem-facet" /> : <span>Chưa có ảnh</span>}
      </Link>
      <div className="product-card__body">
        <div className="product-card__meta">
          <span>{product.type}</span>
          <span>{product.carat == null ? "Chưa có carat" : product.carat + " ct"}</span>
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
            {allowCart && <AddToCartButton product={product} />}
            <button className="btn btn-sm btn-ghost" type="button" aria-label={`Thêm ${product.name} vào yêu thích`}>
              Yêu thích
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}


export default ProductCard;
