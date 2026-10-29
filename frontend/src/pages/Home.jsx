import { TopRatedProducts } from '../engagement/ProductShelves';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import ProductCarousel from '../components/ProductCarousel';
import CatalogSkeleton from '../components/CatalogSkeleton';
import useApiData from '../hooks/useApiData';
import useCategoryTree from '../hooks/useCategoryTree';
import heroImage from '../assets/gem-hero.svg';

export default function Home() {
  const catalog = useApiData('/products/catalog?sort=newest&pageSize=12');
  const categories = useCategoryTree();
  return <div className="catalog-home"><div className="store-container">
    <section className="collection-hero" aria-labelledby="home-hero-title">
      <div className="collection-hero__copy">
        <h1 id="home-hero-title"><span>Khám phá tuyệt tác</span> <span>thiên nhiên:</span> <span>Sapphire &amp; Kim cương hiếm</span></h1>
        <Link className="collection-cta" to="/shop">Xem chi tiết sản phẩm</Link>
      </div>
      <img src={heroImage} alt="" aria-hidden="true" />
    </section>
    <section className="home-categories" aria-labelledby="home-categories-title"><h2 id="home-categories-title">Danh mục đá quý</h2>
      {categories.loading ? <p role="status">Đang tải danh mục…</p> : categories.error && !categories.data ? <p role="alert">{categories.error}</p> :
        <div className="category-ribbon"><nav className="category-ribbon__scroller" aria-label="Danh mục đá quý">
          {categories.data?.map((c, index) => <Fragment key={c.id}>{index > 0 && <span className="category-ribbon__sep" aria-hidden="true">|</span>}
            <Link to={`/shop?category=${c.id}`}>{c.name}</Link></Fragment>)}
          {!categories.data?.length && <span>Chưa có danh mục.</span>}
        </nav></div>}
    </section>
    <section className="home-featured" aria-labelledby="home-featured-title">
      <div className="catalog-heading"><h2 id="home-featured-title">Sản phẩm nổi bật</h2><Link to="/shop">Xem tất cả</Link></div>
      {catalog.loading ? <CatalogSkeleton compact /> : catalog.error ? <p role="alert">{catalog.error}</p> : !catalog.data?.items.length ? <p className="empty-state">Chưa có sản phẩm.</p> : <ProductCarousel products={catalog.data.items} />}
    </section>
    <TopRatedProducts />
  </div></div>;
}
