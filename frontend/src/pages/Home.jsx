import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { featuredProducts, products } from "../data/products";
import heroImage from "../assets/gem-hero.svg";

const categories = ["Ruby", "Sapphire", "Emerald", "Diamond", "Amethyst", "Aquamarine", "Topaz", "Garnet"];

function Home() {
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
            <div className="hero-badges">
              <span>GIA / GRS / SSEF</span>
              <span>Tư vấn 1:1</span>
              <span>Giao hàng bảo hiểm</span>
            </div>
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
            <h2>Đá quý theo màu sắc và cá tính</h2>
          </div>
          <div className="category-grid">
            {categories.map((category) => (
              <Link className="category-tile" to={`/shop?category=${category.toLowerCase()}`} key={category}>
                {category}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="products-section">
        <div className="container">
          <div className="section-title section-title--split">
            <div>
              <p className="eyebrow">Tuyển chọn nổi bật</p>
              <h2>Đá quý nổi bật</h2>
            </div>
            <Link to="/shop">Xem tất cả {products.length} sản phẩm</Link>
          </div>
          <div className="product-grid">
            {featuredProducts.map((product) => (
              <ProductCard product={product} key={product.id} />
            ))}
          </div>
        </div>
      </section>

      <section className="service-strip">
        <div className="container">
          <div>Được gemologist rà soát</div>
          <div>Ưu tiên chứng nhận độc lập</div>
          <div>Giao hàng bảo hiểm toàn cầu</div>
        </div>
      </section>
    </>
  );
}

export default Home;
