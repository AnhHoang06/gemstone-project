import { ChevronIcon } from './Icons';

// Plain numerals "‹ 1 … 5 6 7 8 9 … 36 ›"; the current page is underlined and carries aria-current.
export default function CatalogPagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const numbers = [...new Set([1, totalPages, ...Array.from({ length: 5 }, (_, i) => page + i - 2).filter(n => n >= 1 && n <= totalPages)])].sort((a, b) => a - b);
  return <nav className="catalog-pagination" aria-label="Phân trang sản phẩm">
    <button type="button" className="pagination-step" aria-label="Trang trước" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronIcon direction="left" size={14} /></button>
    {numbers.map((n, i) => <span key={n} className="pagination-item">{i > 0 && n - numbers[i - 1] > 1 && <span className="pagination-gap" aria-hidden="true">…</span>}
      <button type="button" aria-label={`Trang ${n}`} aria-current={n === page ? 'page' : undefined} onClick={() => onChange(n)}>{n}</button></span>)}
    <button type="button" className="pagination-step" aria-label="Trang tiếp" disabled={page >= totalPages} onClick={() => onChange(page + 1)}><ChevronIcon direction="right" size={14} /></button>
  </nav>;
}
