import { useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { resolveImageUrl } from '../api/api';
import { formatPrice } from '../utils/formatPrice';
import { normalizeText } from '../utils/categoryTree';
import { SearchIcon } from './Icons';
import ProductPlaceholder from './ProductPlaceholder';

// Bold every query token inside the name, ignoring accents/case (the API matches token by token).
function Match({ name, query }) {
  const chars = Array.from(name.normalize('NFC'));
  let folded = '';
  const owner = [];
  chars.forEach((char, index) => { for (const piece of normalizeText(char)) { folded += piece; owner.push(index); } });
  const marked = chars.map(() => false);
  for (const token of normalizeText(query).split(/\s+/).filter(Boolean)) {
    for (let at = folded.indexOf(token); at >= 0; at = folded.indexOf(token, at + token.length))
      for (let k = at; k < at + token.length; k++) marked[owner[k]] = true;
  }
  const runs = [];
  chars.forEach((char, index) => {
    const last = runs[runs.length - 1];
    if (last && last.bold === marked[index]) last.text += char; else runs.push({ bold: marked[index], text: char });
  });
  return runs.map((run, index) => run.bold ? <strong key={index}>{run.text}</strong> : <span key={index}>{run.text}</span>);
}
export default function ProductSearchBar() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const q = new URLSearchParams(search).get('q') || '';
  // On /shop the search merges into the current filters (and resets page); elsewhere it starts a new /shop search.
  const submit = value => {
    if (pathname !== '/shop') { navigate(`/shop${value ? `?q=${encodeURIComponent(value)}` : ''}`); return; }
    const next = new URLSearchParams(search);
    if (value) next.set('q', value); else next.delete('q');
    next.delete('page');
    const query = next.toString();
    navigate({ pathname: '/shop', search: query ? `?${query}` : '' });
  };
  return <SearchInput urlQuery={q} onSubmit={submit} onClear={pathname === '/shop' && q ? () => submit('') : null} />;
}
function SearchInput({ urlQuery, onSubmit, onClear }) {
  const [value, setValue] = useState(urlQuery);
  const [synced, setSynced] = useState(urlQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [result, setResult] = useState(null);
  const navigate = useNavigate();
  const ref = useRef(null), id = useId();
  if (synced !== urlQuery) { setSynced(urlQuery); setValue(urlQuery); setActive(-1); }
  const query = value.trim();
  const items = result?.query === query ? result.items : [];
  const shown = open && query.length >= 2;
  const listId = `${id}-results`;
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
    setOpen(false); setActive(-1);
    if (index >= 0 && index < items.length) navigate(`/product/${items[index].id}`);
    else onSubmit(query);
  };
  return <form className="product-search" role="search" onSubmit={event => { event.preventDefault(); go(active); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <span aria-hidden="true" className="search-icon"><SearchIcon /></span>
    <label className="visually-hidden" htmlFor={id}>Tìm đá quý theo tên</label>
    <input ref={ref} id={id} role="combobox" aria-autocomplete="list" aria-controls={shown ? listId : undefined} aria-expanded={shown}
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
    {value && <button type="button" className="search-clear" aria-label="Xóa tìm kiếm" onClick={() => { setValue(''); setActive(-1); onClear?.(); ref.current.focus(); }}>×</button>}
    <button type="submit" className="search-submit">Tìm</button>
    {shown && <div className="search-results">
      {result?.query !== query && <p role="status">Đang tìm kiếm…</p>}
      {result?.query === query && result.error && <p role="status">Chưa tải được gợi ý. Bạn có thể tìm lại.</p>}
      {result?.query === query && !result.error && !items.length && <p role="status">Không có gợi ý theo tên. Bạn vẫn có thể xem tất cả kết quả.</p>}
      <ul id={listId} role="listbox" aria-label="Gợi ý đá quý">
        {items.map((item, index) => <li id={`${id}-option-${index}`} key={item.id} role="option" aria-selected={active === index}
          onMouseDown={event => event.preventDefault()} onClick={() => go(index)}>
          <span className="search-thumb">{item.imageUrl ? <img src={resolveImageUrl(item.imageUrl)} alt="" loading="lazy" decoding="async" /> : <ProductPlaceholder label={false} />}</span>
          <span><Match name={item.name} query={query} /><small>{item.categoryName} · {formatPrice(item.price)}</small></span>
        </li>)}
        <li id={`${id}-option-${items.length}`} role="option" aria-selected={active === items.length} className="search-all"
          onMouseDown={event => event.preventDefault()} onClick={() => go(-1)}>Xem tất cả kết quả cho ‘{query}’</li>
      </ul>
    </div>}
  </form>;
}
