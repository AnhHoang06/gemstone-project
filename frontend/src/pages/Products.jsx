import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ProductSearchBar from '../components/ProductSearchBar';
import CategoryTree from '../components/CategoryTree';
import ProductCard from '../components/ProductCard';
import CatalogSkeleton from '../components/CatalogSkeleton';
import CatalogPagination from '../components/CatalogPagination';
import useApiData from '../hooks/useApiData';
import { flattenCategories } from '../utils/categoryTree';

export default function Products() {
  const [params, setParams] = useSearchParams();
  const tree = useApiData('/categories/tree');
  const flat = flattenCategories(tree.data || []);
  const rawCategory = params.get('category') || '';
  const isId = /^\d+$/.test(rawCategory);
  const named = !isId && rawCategory ? flat.filter(c => c.name.toLowerCase() === rawCategory.toLowerCase()).sort((a, b) => a.depth - b.depth || a.id - b.id)[0] : null;
  const namedId = named?.id;
  const categoryId = isId ? rawCategory : namedId ? String(namedId) : '';
  const selected = flat.find(c => String(c.id) === categoryId);
  useEffect(() => {
    if (!namedId) return;
    const next = new URLSearchParams(params); next.set('category', String(namedId)); setParams(next, { replace: true });
  }, [namedId, params, setParams]);
  const query = new URLSearchParams();
  for (const key of ['q', 'minPrice', 'maxPrice', 'sort', 'page']) if (params.get(key)) query.set(key, params.get(key));
  if (categoryId) query.set('categoryId', categoryId);
  const catalog = useApiData(`/products/catalog?${query}`);
  const grid = useRef(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const change = updates => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(updates)) { if (value) next.set(key, value); else next.delete(key); }
    if (!('page' in updates)) next.delete('page');
    setParams(next);
  };
  const filters = <><h2>Danh mục đá quý</h2>{tree.error && <p role="alert">{tree.error}</p>}{tree.loading && <p role="status">Đang tải danh mục…</p>}
    <Link to="/shop" onClick={() => setFiltersOpen(false)}>Tất cả đá quý</Link>
    <CategoryTree nodes={tree.data || []} selected={categoryId} onSelect={id => change({ category: String(id) })} onNavigate={() => setFiltersOpen(false)} />
    <h2>Bộ lọc</h2><PriceFilter key={`${params.get('minPrice')}:${params.get('maxPrice')}`} min={params.get('minPrice') || ''} max={params.get('maxPrice') || ''} onApply={change} />
    <button className="btn btn-outline" onClick={() => { setParams({}); setFiltersOpen(false); }}>Xóa bộ lọc</button></>;
  return <main className="store-container catalog-page"><ProductSearchBar />
    <nav className="catalog-breadcrumb" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span>/</span><Link to="/shop">Thế giới đá quý</Link>
      {selected?.path.map(c => <span key={c.id}> / <Link to={`/shop?category=${c.id}`} aria-current={c.id === selected.id ? 'page' : undefined}>{c.name}</Link></span>)}</nav>
    <h1>{selected?.name || 'Tất cả đá quý'}</h1>
    <button className="btn catalog-filter-trigger" onClick={() => setFiltersOpen(true)}>Danh mục &amp; bộ lọc</button>
    <div className="shop-catalog-layout"><aside className="catalog-sidebar">{filters}</aside>
      <section ref={grid} className="catalog-results" aria-label="Sản phẩm"><div className="catalog-toolbar">
        <p>{catalog.loading ? 'Đang tải…' : catalog.error ? 'Chưa tải được sản phẩm' : `${catalog.data?.total ?? 0} sản phẩm`}</p>
        <label>Sắp xếp <select value={params.get('sort') || 'newest'} onChange={e => change({ sort: e.target.value })}>
          <option value="newest">Mới nhất</option><option value="price-asc">Giá tăng dần</option><option value="price-desc">Giá giảm dần</option><option value="name-asc">Tên A–Z</option></select></label>
      </div>
      {catalog.loading ? <CatalogSkeleton /> : catalog.error ? <p className="notice notice-error" role="alert">{catalog.error}</p> : catalog.data?.items.length ? <>
        <div className="catalog-grid">{catalog.data.items.map(p => <ProductCard key={p.id} product={p} />)}</div>
        <CatalogPagination page={catalog.data.page} totalPages={catalog.data.totalPages} onChange={page => { change({ page: String(page) }); grid.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }} />
      </> : <div className="empty-state"><p>Không có sản phẩm phù hợp.</p><button className="btn btn-outline" onClick={() => setParams({})}>Xem tất cả đá quý</button></div>}
      </section>
    </div>
    {filtersOpen && <FilterDrawer onClose={() => setFiltersOpen(false)}>{filters}</FilterDrawer>}
  </main>;
}
function PriceFilter({ min, max, onApply }) {
  const [low, setLow] = useState(min), [high, setHigh] = useState(max), [error, setError] = useState('');
  return <form className="catalog-price" noValidate onSubmit={event => {
    event.preventDefault();
    if ([low, high].some(v => v !== '' && (!Number.isFinite(Number(v)) || Number(v) < 0)) || (low !== '' && high !== '' && Number(low) > Number(high))) { setError('Khoảng giá không hợp lệ.'); return; }
    setError(''); onApply({ minPrice: low, maxPrice: high });
  }}><label>Giá từ (đ)<input inputMode="numeric" type="number" min="0" value={low} onChange={e => setLow(e.target.value)} /></label>
    <label>Đến (đ)<input inputMode="numeric" type="number" min="0" value={high} onChange={e => setHigh(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}<button className="btn btn-gold">Lọc giá</button></form>;
}
function FilterDrawer({ onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; const previous = document.activeElement; dialog.showModal(); return () => { dialog.close(); if (previous?.isConnected) previous.focus(); }; }, []);
  return <dialog className="catalog-filter-drawer" ref={ref} aria-label="Danh mục và bộ lọc" onCancel={e => { e.preventDefault(); onClose(); }}>
    <button className="drawer-close" aria-label="Đóng bộ lọc" onClick={onClose}>×</button>{children}</dialog>;
}
