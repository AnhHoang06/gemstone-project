import { useState } from 'react';
import { Link } from 'react-router-dom';
import { findCategoryPath } from '../utils/categoryTree';
import { CategoryIcon, ChevronIcon } from './Icons';

// Shared visual language for the mega menu, mobile drawer and /shop sidebar:
// level 1 = small uppercase heading row, level 2 = "•" group with chevron, level 3 = line icon + link.
function CategoryBranch({ node, level, inPath, selected, expandedFor, onToggle, onNavigate, onSelect }) {
  const children = node.children || [];
  const expanded = children.length > 0 && expandedFor(node, level);
  const current = String(node.id) === String(selected);
  return <li className={`tree-level-${level}${expanded ? ' is-open' : ''}${inPath.has(String(node.id)) ? ' in-path' : ''}`}>
    <div className="category-tree-row">
      {level === 2 && <span className="tree-dot" aria-hidden="true" />}
      {level >= 3 && <CategoryIcon name={node.name} size={18} />}
      <Link to={`/shop?category=${node.id}`} aria-current={current ? 'page' : undefined}
        onClick={event => {
          if (onSelect && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); onSelect(node.id); }
          onNavigate?.();
        }}>{node.name}</Link>
      {children.length > 0 && <button type="button" className="tree-toggle" aria-label={`Nhóm ${node.name}`} aria-expanded={expanded}
        onClick={() => onToggle(node.id, !expanded)}><ChevronIcon direction={expanded ? 'up' : 'down'} /></button>}
    </div>
    {expanded && <ul>{children.map(child => <CategoryBranch key={child.id} node={child} level={level + 1} inPath={inPath} selected={selected}
      expandedFor={expandedFor} onToggle={onToggle} onNavigate={onNavigate} onSelect={onSelect} />)}</ul>}
  </li>;
}

/**
 * @param nodes tree nodes; `startLevel` is the level of those nodes (1 = roots).
 * Level-1 branches start collapsed unless they contain the selection; level-2 groups start open.
 */
export default function CategoryTree({ nodes, selected, onNavigate, onSelect, startLevel = 1, tree = nodes, className = '' }) {
  const [toggled, setToggled] = useState({});
  const inPath = new Set(findCategoryPath(tree, selected).map(node => String(node.id)));
  const expandedFor = (node, level) => toggled[node.id] ?? (level >= 2 || inPath.has(String(node.id)));
  const onToggle = (id, value) => setToggled(previous => ({ ...previous, [id]: value }));
  return <ul className={`category-tree ${className}`.trim()}>{nodes.map(node => <CategoryBranch key={node.id} node={node} level={startLevel} inPath={inPath}
    selected={selected} expandedFor={expandedFor} onToggle={onToggle} onNavigate={onNavigate} onSelect={onSelect} />)}</ul>;
}
