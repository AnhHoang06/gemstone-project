import { useEffect } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { useWishlist } from "../wishlist/context";

function Wishlist() {
  const { items, loading, busy, error, refresh } = useWishlist();
  useEffect(() => { void refresh(); }, [refresh]);
  return (
    <>
      <section className="page-title">
        <div className="container">
          <h1>Yêu thích</h1>
          <p>Những viên đá bạn đã lưu. Sản phẩm ngừng bán sẽ tạm ẩn khỏi danh sách.</p>
        </div>
      </section>
      <section className="products-section">
        <div className="container">
          <button className="btn btn-outline" disabled={loading || busy} onClick={refresh}>Tải lại danh sách</button>
          {error && <p className="notice notice-error" role="alert">{error}</p>}
          {loading ? <p role="status">Đang tải yêu thích...</p> : !error && items?.length === 0 ?
            <div className="empty-state"><p>Bạn chưa có sản phẩm yêu thích.</p><Link className="btn btn-outline" to="/shop">Khám phá đá quý</Link></div> :
            items && <div className="product-grid">{items.map(product =>
              <ProductCard key={product.id} product={{ ...product, type: product.categoryName }} />)}</div>}
        </div>
      </section>
    </>
  );
}

export default Wishlist;
