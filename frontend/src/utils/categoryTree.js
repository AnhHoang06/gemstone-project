export function flattenCategories(nodes, depth = 0, path = []) {
  return nodes.flatMap(node => [{ ...node, depth, path: [...path, node] }, ...flattenCategories(node.children || [], depth + 1, [...path, node])]);
}
export function buildCategoryTree(items, parent = null) {
  return items.filter(item => (item.parentId ?? null) === parent)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi'))
    .map(item => ({ ...item, children: buildCategoryTree(items, item.id) }));
}
