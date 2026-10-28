import { useState } from 'react';
import { Link } from 'react-router-dom';

function CategoryBranch({ node, selected, onNavigate, onSelect }) {
  const [expanded, setExpanded] = useState(true);
  const children = node.children || [];
  return <li><div className="category-tree-row">
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3h12l3 5-9 10L1 8zM1 8h18M4 3l6 15 6-15" fill="none" stroke="currentColor" /></svg>
    <Link to={`/shop?category=${node.id}`} aria-current={String(node.id) === String(selected) ? 'page' : undefined} onClick={event => { if (onSelect && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onSelect(node.id); } onNavigate?.(); }}>{node.name}</Link>
    {children.length > 0 && <button type="button" aria-label={`Nhóm ${node.name}`} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? '−' : '+'}</button>}
  </div>{expanded && children.length > 0 && <ul>{children.map(child => <CategoryBranch key={child.id} node={child} selected={selected} onNavigate={onNavigate} onSelect={onSelect} />)}</ul>}</li>;
}
export default function CategoryTree({ nodes, selected, onNavigate, onSelect }) {
  return <ul className="category-tree">{nodes.map(node => <CategoryBranch key={node.id} node={node} selected={selected} onNavigate={onNavigate} onSelect={onSelect} />)}</ul>;
}
