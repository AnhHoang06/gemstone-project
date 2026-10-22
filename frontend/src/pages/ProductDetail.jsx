import { Link, useParams } from "react-router-dom";
import { formatPrice } from "../utils/formatPrice";
import useApiData from "../hooks/useApiData";
import { storefrontProduct } from "../utils/catalog";
import { resolveImageUrl } from "../api/api";

function ProductDetail() {
  const { id } = useParams();
  const { data, loading, error } = useApiData(`/products/${encodeURIComponent(id)}`);
  if (loading) return <div className="container empty-state" role="status">Đang tải sản phẩm...</div>;
  if (error) return <div className="container empty-state"><p role="alert">{error}</p><Link to="/shop">Quay lại Đá quý</Link></div>;
  const product = storefrontProduct(data);

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
      <section className="page-title">
        <div className="container">
          <h1>{product.name}</h1>
          <p>{product.type} / {product.origin}</p>
        </div>
      </section>
      <section className="detail-section">
        <div className="container">
          <div className="detail-grid">
            <div className="detail-media">
              {product.imageUrl ? <img src={resolveImageUrl(product.imageUrl)} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "contain", position: "relative", zIndex: 1 }} /> : <span>Chưa có ảnh</span>}
            </div>
            <div className="detail-copy">
              <p className="eyebrow">{product.type}</p>
              <h2>{product.name}</h2>
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
              <div className="detail-actions">
                <button className="btn btn-gold" type="button">Thêm giỏ hàng</button>
                <button className="btn btn-outline-dark" type="button">Thêm yêu thích</button>
                <Link className="btn btn-ghost" to="/shop">Quay lại Đá quý</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default ProductDetail;
