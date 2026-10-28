export default function CatalogPagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const numbers = [...new Set([1, totalPages, ...Array.from({ length: 5 }, (_, i) => page + i - 2).filter(n => n >= 1 && n <= totalPages)])].sort((a, b) => a - b);
  return <nav className="catalog-pagination" aria-label="Phân trang sản phẩm">
    <button aria-label="Trang trước" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹</button>
    {numbers.map((n, i) => <span key={n}>{i > 0 && n - numbers[i - 1] > 1 && <span className="pagination-gap">…</span>}
      <button aria-label={`Trang ${n}`} aria-current={n === page ? 'page' : undefined} onClick={() => onChange(n)}>{n}</button></span>)}
    <button aria-label="Trang tiếp" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>›</button>
  </nav>;
}
