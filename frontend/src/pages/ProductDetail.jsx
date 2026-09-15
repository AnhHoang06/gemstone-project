import { Link, useParams } from "react-router-dom";
import { products } from "../data/products";
import { formatPrice } from "../components/ProductCard";

function ProductDetail() {
  const { id } = useParams();
  const product = products.find((item) => item.id === id) || products[0];

  const specs = [
    ["Loại đá", product.type],
    ["Carat", `${product.carat} ct`],
    ["Màu", product.color],
    ["Độ tinh khiết", product.clarity],
    ["Kiểu cắt", product.cut],
    ["Kích thước", product.dimensions],
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
            <div className="detail-media" style={{ "--gem-color": product.accent }}>
              <span className="gem-facet gem-facet--large" />
            </div>
            <div className="detail-copy">
              <p className="eyebrow">Đá quý cao cấp có hồ sơ thẩm định</p>
              <h2>{product.name}</h2>
              <div className="detail-price">{formatPrice(product.price)}</div>
              <p>{product.description}</p>
              <dl className="spec-list">
                {specs.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
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
