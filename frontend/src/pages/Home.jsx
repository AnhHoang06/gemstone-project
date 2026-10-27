import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import useApiData from "../hooks/useApiData";
import { storefrontProduct } from "../utils/catalog";
import heroImage from "../assets/gem-hero.svg";


function Home() {
  const catalog = useApiData("/products");
  const categoryList = useApiData("/categories");
  const products = (catalog.data || []).map(storefrontProduct);
  const categories = categoryList.data || [];
  const latestProducts = products.slice(0, 4);
  return (
    <>
      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-content">
            <p className="eyebrow">Nhà tuyển chọn đá quý cao cấp</p>
            <h1>Gem Aurelia</h1>
            <p>
              Ruby, Sapphire, Emerald và Diamond được tuyển chọn theo độ rực, xuất xứ và vẻ đẹp bền vững.
            </p>
            <Link className="btn btn-gold btn-lg" to="/shop">
              Khám phá bộ sưu tập
            </Link>
          </div>
          <div className="hero-artwork" aria-hidden="true">
            <img src={heroImage} alt="" />
          </div>
        </div>
      </section>

      <section className="category-band">
        <div className="container">
          <div className="section-title">
            <p className="eyebrow">Danh mục tuyển chọn</p>
            <h2>Khám phá theo loại đá</h2>
          </div>
          <div className="category-grid">
            {categoryList.loading && <p role="status">Đang tải danh mục...</p>}
            {categoryList.error && <p role="alert">{categoryList.error}</p>}
            {!categoryList.loading && !categoryList.error && !categories.length && <p>Chưa có danh mục.</p>}
            {categories.map((category) => (
              <Link className="category-tile" to={`/shop?category=${encodeURIComponent(category.name.toLowerCase())}`} key={category.id}>
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="products-section">
        <div className="container">
          <div className="section-title section-title--split">
            <div>
              <p className="eyebrow">Mới cập nhật</p>
              <h2>Đá quý mới nhất</h2>
            </div>
            <Link to="/shop">Xem tất cả{catalog.data ? ` ${products.length} sản phẩm` : ""}</Link>
          </div>
          <div className="product-grid">
            {catalog.loading && <p role="status">Đang tải sản phẩm...</p>}
            {catalog.error && <p role="alert">{catalog.error}</p>}
            {!catalog.loading && !catalog.error && !products.length && <p>Chưa có sản phẩm.</p>}
            {latestProducts.map((product) => (
              <ProductCard product={product} key={product.id} />
            ))}
          </div>
        </div>
      </section>


    </>
  );
}

export default Home;
