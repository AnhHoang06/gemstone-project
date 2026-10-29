import { expect, it } from 'vitest';
import { categoryIconKind, findCategoryPath, normalizeText, subtreeHeight } from './categoryTree';

it('maps level-3 category names to icons by keyword, ignoring accents and case', () => {
  const cases = {
    'Nhẫn Three-stone & Đính đá phụ': 'ring', 'NHAN HALO': 'ring', 'Dây chuyền & Mặt dây': 'necklace', 'Vòng cổ & Choker': 'necklace',
    'Bông tai Đeo sát & Vòng': 'earring', 'Hoa tai thả': 'earring', 'Lắc tay & Vòng tay charm': 'bracelet', 'Vòng tay Cứng (Bangle)': 'bracelet',
    'Kiềng đeo cổ (Necklace Collar)': 'kieng', 'Ghim cài áo (Brooch)': 'brooch', 'Phụ kiện tóc (Hair Accessory)': 'brooch',
    'Ruby Myanmar': 'gem', 'Nhan': 'ring', 'Thanh lịch': 'gem',
    'Kim cương nhân tạo': 'gem', 'Nhẫn kim cương nhân tạo': 'ring',
  };
  for (const [name, kind] of Object.entries(cases)) expect([name, categoryIconKind(name)]).toEqual([name, kind]);
});
it('finds a root-to-node path and measures subtree height', () => {
  const tree = [{ id: 1, name: 'Diamond', children: [{ id: 2, name: 'Nhẫn', children: [{ id: 3, name: 'Halo', children: [] }] }] }];
  expect(findCategoryPath(tree, '3').map(node => node.id)).toEqual([1, 2, 3]);
  expect(findCategoryPath(tree, 9)).toEqual([]);
  expect(subtreeHeight(tree[0])).toBe(3);
  expect(subtreeHeight(tree[0].children[0].children[0])).toBe(1);
  expect(normalizeText('ĐÁ QUÝ Kim Cương')).toBe('da quy kim cuong');
});
