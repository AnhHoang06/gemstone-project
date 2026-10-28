import { Link } from 'react-router-dom';
import ProductCarousel from '../components/ProductCarousel';
import CatalogSkeleton from '../components/CatalogSkeleton';
import useApiData from '../hooks/useApiData';
import heroImage from '../assets/gem-hero.svg';

export default function Home() {
  const catalog = useApiData('/products/catalog?sort=newest&pageSize=12');
  const categories = useApiData('/categories/tree');
  return <main className="catalog-home"><div className="store-container">
    <section className="collection-hero"><div><p className="store-eyebrow">Gem Aurelia · Đá quý tự nhiên</p>
      <h1>Khám phá tuyệt tác thiên nhiên: Sapphire &amp; Kim cương hiếm</h1>
      <Link className="btn collection-cta" to="/shop">Xem bộ sưu tập</Link></div>
      <img src={heroImage} alt="" aria-hidden="true" /></section>
    <section className="home-categories"><h2>Danh mục đá quý</h2>
      {categories.loading ? <p role="status">Đang tải danh mục…</p> : categories.error ? <p role="alert">{categories.error}</p> :
        <nav className="category-ribbon" aria-label="Danh mục đá quý">{categories.data?.map(c => <Link key={c.id} to={`/shop?category=${c.id}`}>{c.name}</Link>)}{!categories.data?.length && <span>Chưa có danh mục.</span>}</nav>}
    </section>
    <section className="home-featured"><div className="catalog-heading"><div><h2>Sản phẩm nổi bật</h2><p>Các sản phẩm mới nhất trong bộ sưu tập.</p></div><Link to="/shop">Xem tất cả</Link></div>
      {catalog.loading ? <CatalogSkeleton /> : catalog.error ? <p role="alert">{catalog.error}</p> : !catalog.data?.items.length ? <p className="empty-state">Chưa có sản phẩm.</p> : <ProductCarousel products={catalog.data.items} />}
    </section>
  </div></main>;
}
