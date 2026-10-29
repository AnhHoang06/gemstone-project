export default function CatalogSkeleton({ compact = false }) {
  return <div className={compact ? 'catalog-grid catalog-grid--compact' : 'catalog-grid'} aria-label="Đang tải sản phẩm" role="status">{Array.from({ length: 4 }, (_, i) => <div className="catalog-skeleton" key={i}><div /><p /><p /></div>)}</div>;
}
