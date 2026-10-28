export default function CatalogSkeleton() {
  return <div className="catalog-grid" aria-label="Đang tải sản phẩm" role="status">{Array.from({ length: 4 }, (_, i) => <div className="catalog-skeleton" key={i}><div /><p /><p /></div>)}</div>;
}
