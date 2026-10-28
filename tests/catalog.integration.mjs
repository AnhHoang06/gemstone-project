// Run against a local test/development database only. Creates and cleans up its own fixtures.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const base = process.env.PERSON3_API_URL || 'http://localhost:5113';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Only local test APIs are allowed');
const tag = `catalog-${randomUUID().replaceAll('-', '')}`;
const users = [], products = [];
let categoryId;
const sql = query => execFileSync('sqlcmd', ['-S', process.env.PERSON3_SQL_SERVER || '.\\SQLEXPRESS', '-d', process.env.PERSON3_SQL_DATABASE || 'GemstoneShop', '-E', '-C', '-b', '-h', '-1', '-W', '-Q', `SET NOCOUNT ON; ${query}`], { encoding: 'utf8' }).trim();
const scalar = query => Number(sql(query));
async function call(token, method, path, body) {
  const response = await fetch(`${base}/api${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const raw = await response.text();
  let data; try { data = JSON.parse(raw); } catch { data = raw; }
  return { status: response.status, data };
}
function expect(response, status) { assert.equal(response.status, status, JSON.stringify(response.data)); return response.data; }
async function user(role) {
  const email = `${tag}-${users.length}@example.invalid`, password = `${randomUUID()}!aA9`;
  expect(await call(null, 'POST', '/auth/register', { fullName: tag, email, password }), 200);
  const id = scalar(`SELECT Id FROM Users WHERE Email='${email}'`);
  users.push(id);
  if (role === 'Admin') sql(`UPDATE Users SET RoleId=(SELECT Id FROM Roles WHERE Name='Admin') WHERE Id=${id}`);
  return { id, ...expect(await call(null, 'POST', '/auth/login', { email, password }), 200) };
}
async function product(admin, stock, price = 123) {
  const p = expect(await call(admin.token, 'POST', '/products', { categoryId, name: tag, price, stock, isActive: true }), 201);
  products.push(p.id); return p.id;
}

const categories = [];
try {
  const admin = await user('Admin'), a = await user('Customer');
  const category = async (name, parentId = null, isActive = true) => {
    const c = expect(await call(admin.token, 'POST', '/categories', { name, parentId, isActive }), 201);
    categories.push(c.id); return c.id;
  };
  const root = await category(tag), other = await category(`${tag}-other`);
  const child = await category(`${tag}-Nhẫn`, root);
  await category(`${tag}-Nhẫn`, other); // verifies SQL uniqueness and unchanged scaffold metadata at runtime
  const leaf = await category(`${tag}-leaf`, child);
  categoryId = leaf;
  expect(await call(admin.token, 'POST', '/categories', { name: 'too deep', parentId: leaf }), 400);
  expect(await call(admin.token, 'POST', '/categories', { name: `${tag}-Nhẫn`, parentId: root }), 400);
  expect(await call(admin.token, 'PUT', `/categories/${root}`, { name: tag, parentId: leaf, isActive: true }), 400);
  expect(await call(admin.token, 'DELETE', `/categories/${root}`), 400);
  expect(await call(a.token, 'GET', '/categories?includeInactive=true'), 403);
  const tree = expect(await call(null, 'GET', '/categories/tree'), 200);
  assert.equal(tree.find(c => c.id === root).children[0].children[0].id, leaf);
  const p = await product(admin, 10, 1000000);
  expect(await call(admin.token, 'PUT', `/products/${p}`, { name: 'Đá quý Kim cương đư ơ ă â', categoryId: leaf, price: 1000000, stock: 10, isActive: true }), 204);
  for (const q of ['da quy', 'kim cuong', 'du o a a', 'ĐÁ QUÝ']) {
    const result = expect(await call(null, 'GET', `/products/catalog?categoryId=${root}&q=${encodeURIComponent(q)}`), 200);
    assert.equal(result.total, 1); assert.equal(result.items[0].id, p);
  }
  await product(admin, 2, 100); await product(admin, 2, 200);
  const page = expect(await call(null, 'GET', `/products/catalog?categoryId=${root}&pageSize=2&sort=price-asc`), 200);
  assert.equal(page.total, 3); assert.equal(page.totalPages, 2); assert.equal(page.items.length, 2);
  assert.equal(page.items[0].price, 100);
  for (const query of ['page=0', 'minPrice=-1', 'minPrice=10&maxPrice=1', 'pageSize=49', 'sort=bad'])
    expect(await call(null, 'GET', `/products/catalog?${query}`), 400);
  expect(await call(a.token, 'POST', `/cart/items/${p}`, { quantity: 1 }), 200);
  expect(await call(a.token, 'POST', `/wishlist/${p}`), 200);
  expect(await call(admin.token, 'PUT', `/categories/${root}`, { name: tag, isActive: false }), 204);
  assert.equal(expect(await call(null, 'GET', `/products/catalog?categoryId=${root}`), 200).total, 0);
  assert.equal(expect(await call(null, 'GET', `/products?categoryId=${leaf}`), 200).length, 0);
  expect(await call(null, 'GET', `/products/${p}`), 404);
  expect(await call(null, 'GET', `/categories/${leaf}`), 404);
  assert.ok(!expect(await call(null, 'GET', '/categories'), 200).some(c => c.id === leaf));
  expect(await call(admin.token, 'GET', `/products/${p}?includeInactive=true`), 200);
  for (const method of ['POST', 'PUT']) expect(await call(a.token, method, `/cart/items/${p}`, { quantity: 1 }), 409);
  expect(await call(a.token, 'POST', `/wishlist/${p}`), 409);
  assert.equal(expect(await call(a.token, 'GET', '/wishlist'), 200).length, 0);
  expect(await call(a.token, 'POST', '/orders', { requestId: randomUUID(), recipientName: 'Test', recipientPhone: '0900000000', shippingAddress: 'Test' }), 409);
  assert.equal(scalar(`SELECT Stock FROM Products WHERE Id=${p}`), 10);
  console.log('PASS: hierarchy, sibling uniqueness, cycle/depth checks, ancestor visibility, checkout rejection, Vietnamese search, pagination');
} finally {
  if (users.length) {
    const ids = users.join(',');
    sql(`DELETE FROM WishlistItems WHERE UserId IN (${ids}); DELETE FROM CartItems WHERE CartId IN (SELECT Id FROM Carts WHERE UserId IN (${ids})); DELETE FROM Carts WHERE UserId IN (${ids}); DELETE FROM Users WHERE Id IN (${ids});`);
  }
  if (products.length) sql(`DELETE FROM Products WHERE Id IN (${products.join(',')})`);
  for (const id of categories.reverse()) sql(`DELETE FROM Categories WHERE Id=${id}`);
  console.log('Temporary catalog fixtures cleaned up.');
}
