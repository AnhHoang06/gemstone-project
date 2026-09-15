import ProductCard from "../components/ProductCard";
import { wishlistItems } from "../data/products";

function Wishlist() {
  // TODO: Replace static wishlist items with user-specific data after auth/backend wiring.
  return (
    <>
      <section className="page-title">
        <div className="container">
          <h1>Yêu thích</h1>
          <p>Danh sách yêu thích đang dùng dữ liệu minh họa để xem nhanh các viên đá đã lưu.</p>
        </div>
      </section>
      <section className="products-section">
        <div className="container">
          <div className="product-grid">
            {wishlistItems.map((product) => (
              <ProductCard product={product} key={product.id} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export default Wishlist;
