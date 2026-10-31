import ProductReviews from '../engagement/ProductReviews';
import ProductQuestions from '../engagement/ProductQuestions';
import { RelatedProducts, RecentlyViewed, LowStock } from '../engagement/ProductShelves';
import { Link, useParams } from "react-router-dom";
import { formatPrice } from "../utils/formatPrice";
import useApiData from "../hooks/useApiData";
import useCategoryTree from "../hooks/useCategoryTree";
import { storefrontProduct } from "../utils/catalog";
import { findCategoryPath } from "../utils/categoryTree";
import ProductGallery from "../components/ProductGallery";
import AddToCartButton from "../components/AddToCartButton";
import FavoriteToggle from "../components/FavoriteToggle";
import ProductSearchBar from "../components/ProductSearchBar";
import ChatProductContext from "../chat/ChatProductContext";

function ProductDetail() {
  return <div className="store-container catalog-page product-detail-page"><ProductSearchBar /><ProductDetailContent /></div>;
}
function ProductDetailContent() {
  const { id } = useParams();
  const { data, loading, error } = useApiData(`/products/${encodeURIComponent(id)}`);
  const tree = useCategoryTree();
  if (loading) return <div className="empty-state" role="status">Đang tải sản phẩm...</div>;
  if (error) return <div className="empty-state"><p role="alert">{error}</p><Link to="/shop">Quay lại Đá quý</Link></div>;
  const product = storefrontProduct(data);
  const categoryPath = findCategoryPath(tree.data, product.categoryId);

  const specs = [
    ["Loại đá", product.type],
    ["Carat", product.carat == null ? "Chưa có thông tin" : `${product.carat} ct`],
    ["Màu", product.color],
    ["Độ tinh khiết", product.clarity],
    ["Kiểu cắt", product.cut],
    ["Xuất xứ", product.origin],
    ["Chứng nhận", product.certification],
  ];

  return (
    <>
      <ChatProductContext product={product} />
      <nav className="catalog-breadcrumb" aria-label="Đường dẫn">
        <Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><Link to="/shop">Thế giới đá quý</Link>
        {categoryPath.map(c => <span key={c.id}><span aria-hidden="true">/ </span><Link to={`/shop?category=${c.id}`}>{c.name}</Link></span>)}
        <span><span aria-hidden="true">/ </span><span aria-current="page">{product.name}</span></span>
      </nav>
      <h1>{product.name}</h1>
      <section className="detail-section" aria-label="Thông tin sản phẩm">
        <div className="detail-grid">
          <ProductGallery key={product.id} product={product} />
          <div className="detail-copy">
            <p className="eyebrow">{[product.type, product.origin].filter(Boolean).join(" / ")}</p>
            <div className="detail-price">{formatPrice(product.price)}</div>
            <p>{product.description}</p>
            <dl className="spec-list">
              {specs.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || "Chưa có thông tin"}</dd>
                </div>
              ))}
            </dl>
            {product.certificate?.certificateUrl && <p><a href={product.certificate.certificateUrl} target="_blank" rel="noreferrer">Xem giấy chứng nhận</a></p>}
            <LowStock stock={product.stock} /><div className="detail-actions">
              <AddToCartButton product={product} />
              <FavoriteToggle product={product} />
              <Link className="btn btn-ghost" to="/shop">Quay lại Đá quý</Link>
            </div>
          </div>
        </div>
      </section>
      <RelatedProducts productId={product.id} /><ProductReviews productId={product.id} /><ProductQuestions productId={product.id} /><RecentlyViewed productId={product.id} />
    </>
  );
}

export default ProductDetail;
