import { useEffect } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { useWishlist } from "../wishlist/context";
import ProductSearchBar from "../components/ProductSearchBar";

function Wishlist() {
  const { items, loading, busy, error, refresh } = useWishlist();
  useEffect(() => { void refresh(); }, [refresh]);
  return (
    <div className="store-container catalog-page wishlist-page">
      <ProductSearchBar />
      <nav className="catalog-breadcrumb" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><span aria-current="page">Yêu thích</span></nav>
      <div className="catalog-title-row">
        <div><h1>Yêu thích</h1><p className="catalog-lead">Những viên đá bạn đã lưu. Sản phẩm ngừng bán sẽ tạm ẩn khỏi danh sách.</p></div>
        <button className="btn btn-outline catalog-reset" disabled={loading || busy} onClick={refresh}>Tải lại danh sách</button>
      </div>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {loading ? <p role="status">Đang tải yêu thích...</p> : !error && items?.length === 0 ?
        <div className="empty-state"><p>Bạn chưa có sản phẩm yêu thích.</p><Link className="btn btn-outline" to="/shop">Khám phá đá quý</Link></div> :
        items && <div className="catalog-grid">{items.map(product =>
          <ProductCard key={product.id} product={{ ...product, type: product.categoryName }} />)}</div>}
    </div>
  );
}

export default Wishlist;
