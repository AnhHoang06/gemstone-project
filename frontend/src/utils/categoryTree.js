export function flattenCategories(nodes, depth = 0, path = []) {
  return nodes.flatMap(node => [{ ...node, depth, path: [...path, node] }, ...flattenCategories(node.children || [], depth + 1, [...path, node])]);
}
export function buildCategoryTree(items, parent = null) {
  return items.filter(item => (item.parentId ?? null) === parent)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi'))
    .map(item => ({ ...item, children: buildCategoryTree(items, item.id) }));
}
/** Nodes from the root down to the category with `id` (empty when not found). */
export function findCategoryPath(nodes, id) {
  if (id == null || id === '') return [];
  for (const node of nodes || []) {
    if (String(node.id) === String(id)) return [node];
    const below = findCategoryPath(node.children, id);
    if (below.length) return [node, ...below];
  }
  return [];
}
/** Number of levels in the subtree rooted at `node` (a leaf is 1). */
export function subtreeHeight(node) {
  return 1 + Math.max(0, ...(node.children || []).map(subtreeHeight));
}
export const MAX_CATEGORY_DEPTH = 3;

/** Accent-insensitive, lower-case form used for matching Vietnamese text (đ → d). */
export function normalizeText(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

// Order matters: "Kiềng đeo cổ (Necklace Collar)" is a kiềng, "Bông tai … Vòng" is an earring.
const ICON_RULES = [
  ['kieng', ['kieng']],
  ['earring', ['bong tai', 'hoa tai', 'khuyen tai', 'earring']],
  ['ring', ['nhan', 'ring']],
  ['necklace', ['day chuyen', 'vong co', 'mat day', 'choker', 'necklace', 'pendant']],
  ['bracelet', ['vong tay', 'lac tay', 'bangle', 'bracelet']],
  ['brooch', ['ghim', 'cai ao', 'cai toc', 'kep toc', 'phu kien toc', 'brooch', 'hair accessory']],
];
/** Icon kind for a category name, matched by whole words regardless of accents. */
export function categoryIconKind(name) {
  const words = ` ${normalizeText(name).replace(/[^a-z0-9]+/g, ' ').trim()} `;
  return ICON_RULES.find(([, keys]) => keys.some(key => words.includes(` ${key} `)))?.[0] || 'gem';
}
