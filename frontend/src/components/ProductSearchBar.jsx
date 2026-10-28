import { useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { resolveImageUrl } from '../api/api';
import { formatPrice } from '../utils/formatPrice';

const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
function Match({ name, query }) {
  const index = normalize(name).indexOf(normalize(query));
  return index < 0 ? name : <>{name.slice(0, index)}<strong>{name.slice(index, index + query.length)}</strong>{name.slice(index + query.length)}</>;
}
export default function ProductSearchBar() {
  const { search } = useLocation();
  const q = new URLSearchParams(search).get('q') || '';
  return <SearchInput key={q} initial={q} />;
}
function SearchInput({ initial }) {
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [result, setResult] = useState(null);
  const navigate = useNavigate();
  const ref = useRef(null), id = useId();
  const query = value.trim();
  const items = result?.query === query ? result.items : [];
  const shown = open && query.length >= 2;
  useEffect(() => {
    if (query.length < 2) return;
    let current = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api.get(`/products/catalog?q=${encodeURIComponent(query)}&pageSize=5`, { signal: controller.signal })
        .then(({ data }) => { if (current) setResult({ query, items: data.items }); })
        .catch(() => { if (current) setResult({ query, items: [], error: true }); });
    }, 300);
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [query]);
  const go = index => {
    setOpen(false);
    navigate(index >= 0 && index < items.length ? `/product/${items[index].id}` : `/shop${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  };
  return <form className="product-search" role="search" onSubmit={event => { event.preventDefault(); go(active); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <span aria-hidden="true" className="search-icon">⌕</span>
    <label className="visually-hidden" htmlFor={id}>Tìm đá quý theo tên</label>
    <input ref={ref} id={id} role="combobox" aria-autocomplete="list" aria-controls={`${id}-results`} aria-expanded={shown}
      aria-activedescendant={shown && active >= 0 ? `${id}-option-${active}` : undefined}
      placeholder="Tìm đá quý theo tên…" value={value} autoComplete="off"
      onFocus={() => setOpen(true)} onChange={event => { setValue(event.target.value); setActive(-1); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { setOpen(false); setActive(-1); }
        if (query.length >= 2 && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
          event.preventDefault(); setOpen(true);
          setActive(previous => event.key === 'ArrowDown' ? Math.min(items.length, previous + 1) : Math.max(-1, previous - 1));
        }
      }} />
    {value && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => { setValue(''); setActive(-1); ref.current.focus(); }}>×</button>}
    <button type="submit" className="search-submit">Tìm</button>
    {shown && <div className="search-results">
      {result?.query !== query && <p role="status">Đang tìm kiếm…</p>}
      {result?.query === query && result.error && <p role="status">Chưa tải được gợi ý. Bạn có thể tìm lại.</p>}
      <ul id={`${id}-results`} role="listbox" aria-label="Gợi ý đá quý">
        {items.map((item, index) => <li id={`${id}-option-${index}`} key={item.id} role="option" aria-selected={active === index}
          onMouseDown={event => event.preventDefault()} onClick={() => go(index)}>
          {item.imageUrl && <img src={resolveImageUrl(item.imageUrl)} alt="" loading="lazy" decoding="async" />}
          <span><Match name={item.name} query={query} /><small>{item.categoryName} · {formatPrice(item.price)}</small></span>
        </li>)}
        <li id={`${id}-option-${items.length}`} role="option" aria-selected={active === items.length}
          onMouseDown={event => event.preventDefault()} onClick={() => go(-1)}>Xem tất cả kết quả cho ‘{query}’</li>
      </ul>
    </div>}
  </form>;
}
