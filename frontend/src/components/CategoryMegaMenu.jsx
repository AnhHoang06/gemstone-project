import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CategoryTree from './CategoryTree';
import { ChevronIcon } from './Icons';

// Narrow two-step panel: list of level-1 categories → the chosen category's tree (mockup 26d678bb).
export default function CategoryMegaMenu({ id, nodes, loading, error, initialRootId, selected, onNavigate }) {
  const initial = nodes.find(node => String(node.id) === String(initialRootId) && node.children?.length);
  const [rootId, setRootId] = useState(initial?.id ?? null);
  const [focusTarget, setFocusTarget] = useState(null);
  const panel = useRef(null);
  const root = nodes.find(node => node.id === rootId);
  useEffect(() => {
    if (!focusTarget) return;
    const element = focusTarget === 'back' ? panel.current?.querySelector('.mega-back') : panel.current?.querySelector(`[data-root="${focusTarget}"]`);
    element?.focus();
  }, [focusTarget, rootId]);
  const open = node => { setRootId(node.id); setFocusTarget('back'); };
  const back = () => { setFocusTarget(String(rootId)); setRootId(null); };
  return <div id={id} ref={panel} className="store-mega-panel">
    {loading && <p role="status" className="mega-status">Đang tải danh mục…</p>}
    {error && <p role="alert" className="mega-status">{error}</p>}
    {root ? <>
      <button type="button" className="mega-back" onClick={back}><ChevronIcon direction="left" /> Tất cả danh mục</button>
      <h2 className="mega-heading">{root.name}</h2>
      <CategoryTree nodes={root.children} tree={nodes} startLevel={2} selected={selected} onNavigate={onNavigate} />
      <Link className="mega-all" to={`/shop?category=${root.id}`} onClick={onNavigate}>Xem tất cả {root.name}</Link>
    </> : <>
      {!loading && !error && !nodes.length && <p className="mega-status">Chưa có danh mục.</p>}
      <ul className="mega-roots">{nodes.map(node => <li key={node.id}>{node.children?.length
        ? <button type="button" data-root={node.id} aria-label={`${node.name}: xem danh mục con`} onClick={() => open(node)}>{node.name}<ChevronIcon direction="right" /></button>
        : <Link to={`/shop?category=${node.id}`} aria-current={String(node.id) === String(selected) ? 'page' : undefined} onClick={onNavigate}>{node.name}</Link>}</li>)}</ul>
      <Link className="mega-all" to="/shop" onClick={onNavigate}>Xem tất cả đá quý</Link>
    </>}
  </div>;
}
