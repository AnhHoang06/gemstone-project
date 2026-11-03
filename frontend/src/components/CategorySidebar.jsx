export default function CategorySidebar({ categories, value, onChange, loading, error, byId = false, children }) {
  const all = byId ? "" : "all";
  return <aside className="catalog-sidebar">
    <details open className="category-menu">
      <summary>Danh mục đá quý</summary>
      <nav aria-label="Danh mục sản phẩm">
        <button type="button" aria-pressed={value === all} onClick={() => onChange(all)}>Tất cả đá quý</button>
        {loading && <p role="status">Đang tải danh mục...</p>}
        {error && <p role="alert">{error}</p>}
        {categories.map(category => {
          const key = byId ? String(category.id) : category.name.toLowerCase();
          return <button type="button" key={category.id} aria-pressed={String(value).toLowerCase() === key.toLowerCase()}
            onClick={() => onChange(key)}>{category.name}</button>;
        })}
        {!loading && !error && !categories.length && <p>Chưa có danh mục.</p>}
      </nav>
    </details>
    {children && <details open className="category-menu catalog-filter-section"><summary>Bộ lọc</summary>{children}</details>}
    {byId && <p className="catalog-sidebar-hint">Chọn danh mục rồi nhấn “Lọc” để áp dụng.</p>}
    <p className="catalog-sidebar-note">Khám phá thông tin màu sắc, carat và xuất xứ trên từng sản phẩm.</p>
  </aside>;
}
