// Run against a local test/development database only. Creates and cleans up its own fixtures.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// CATALOG_* wins; PERSON3_* kept for existing local setups.
const env = name => process.env[`CATALOG_${name}`] || process.env[`PERSON3_${name}`];
const base = env('API_URL') || 'http://localhost:5113';
// "Restart" = a second API process started by this test against the same DB (it runs the SearchName backfill on startup).
// It inherits this process's env (ConnectionStrings__DefaultConnection, Jwt__Key or user secrets). CATALOG_SKIP_RESTART=1 skips it.
const restartBase = process.env.CATALOG_RESTART_URL || 'http://localhost:5115';
for (const url of [base, restartBase])
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Only local test APIs are allowed');
const projectDir = fileURLToPath(new URL('../backend/GemstoneShop/GemstoneShop/', import.meta.url));
const tag = `catalog-${randomUUID().replaceAll('-', '')}`;
const users = [], products = [];
let categoryId, restarted;
const sql = query => execFileSync('sqlcmd', ['-S', env('SQL_SERVER') || '.\\SQLEXPRESS', '-d', env('SQL_DATABASE') || 'GemstoneShop', '-E', '-C', '-b', '-h', '-1', '-W', '-Q', `SET NOCOUNT ON; ${query}`], { encoding: 'utf8' }).trim();
const scalar = query => Number(sql(query));
async function call(token, method, path, body, apiBase = base) {
  const response = await fetch(`${apiBase}/api${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const raw = await response.text();
  let data; try { data = JSON.parse(raw); } catch { data = raw; }
  return { status: response.status, data };
}
function expect(response, status) { assert.equal(response.status, status, JSON.stringify(response.data)); return response.data; }
const searchIds = async (q, apiBase = base, extra = '') =>
  expect(await call(null, 'GET', `/products/catalog?q=${encodeURIComponent(q)}${extra}`, undefined, apiBase), 200).items.map(i => i.id);
const sqlText = value => `N'${value.replaceAll("'", "''")}'`;
function backendDll() {
  if (process.env.CATALOG_BACKEND_DLL) return process.env.CATALOG_BACKEND_DLL;
  const binDir = `${projectDir}bin/Debug/`;
  const tfm = existsSync(binDir) && readdirSync(binDir).find(d => existsSync(`${binDir}${d}/GemstoneShop.dll`));
  if (!tfm) throw new Error('Build the backend first (GemstoneShop.dll not found) or set CATALOG_BACKEND_DLL');
  return `${binDir}${tfm}/GemstoneShop.dll`;
}
async function startSecondInstance() {
  const child = spawn('dotnet', [backendDll(), '--urls', restartBase], { cwd: projectDir, stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, ASPNETCORE_ENVIRONMENT: process.env.ASPNETCORE_ENVIRONMENT || 'Development' } });
  let stderr = ''; child.stderr.on('data', d => { stderr += d; });
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error(`Second API instance exited (${child.exitCode}): ${stderr}`);
    try { if ((await fetch(`${restartBase}/api/categories/tree`)).ok) return child; } catch { /* not listening yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  child.kill('SIGTERM'); throw new Error(`Second API instance did not start: ${stderr}`);
}
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
  expect(await call(admin.token, 'PUT', `/categories/${root}`, { name: tag, parentId: leaf, sortOrder: 0, isActive: true }), 400);
  expect(await call(admin.token, 'DELETE', `/categories/${root}`), 400);
  // PUT requires parentId and sortOrder to be present (null parentId = root is still valid); POST keeps its defaults.
  for (const body of [{ name: `${tag}-Nhẫn`, isActive: true, sortOrder: 0 }, { name: `${tag}-Nhẫn`, isActive: true, parentId: root }, { name: `${tag}-Nhẫn`, isActive: true }]) {
    const bad = expect(await call(admin.token, 'PUT', `/categories/${child}`, body), 400);
    assert.match(JSON.stringify(bad), /parentId|sortOrder/i);
  }
  assert.equal(sql(`SELECT CONCAT(ParentId, '|', SortOrder) FROM Categories WHERE Id=${child}`), `${root}|0`);
  expect(await call(admin.token, 'PUT', `/categories/${other}`, { name: `${tag}-other`, parentId: null, sortOrder: 7, isActive: true }), 204);
  assert.equal(sql(`SELECT CONCAT(ISNULL(ParentId, 0), '|', SortOrder) FROM Categories WHERE Id=${other}`), '0|7');
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
  // Out-of-range page is clamped to the last page; the response reports the page actually served.
  const clamped = expect(await call(null, 'GET', `/products/catalog?categoryId=${root}&pageSize=2&sort=price-asc&page=99`), 200);
  assert.equal(clamped.page, 2); assert.equal(clamped.totalPages, 2); assert.equal(clamped.items.length, 1); assert.equal(clamped.items[0].price, 1000000);
  const empty = expect(await call(null, 'GET', `/products/catalog?categoryId=${root}&q=${tag}-nothing&page=5`), 200);
  assert.deepEqual([empty.page, empty.totalPages, empty.total, empty.items.length], [1, 0, 0, 0]);

  // Token search: every word must occur, in any order, not necessarily adjacent.
  const three = await product(admin, 3, 300);
  expect(await call(admin.token, 'PUT', `/products/${three}`, { name: `Nhẫn Kim cương Three-stone ${tag}`, categoryId: leaf, price: 300, stock: 3, isActive: true }), 204);
  for (const q of [`nhan three ${tag}`, `THREE ${tag} nhẫn`, `${tag}   kim   three-stone`]) assert.deepEqual(await searchIds(q), [three], q);
  assert.deepEqual(await searchIds(`nhan three ${tag} ruby`), []);

  // Product inserted by SQL (SearchName NULL) is searchable at once via the Name fallback, with or without accents,
  // including a decomposed (NFD/Unikey) name.
  const nfdName = `${tag} Nha\u0302\u0303n Đá Lục Bảo`.normalize('NFD');
  const sqlProduct = scalar(`INSERT INTO Products (CategoryId, Name, Price, Stock, IsActive) OUTPUT INSERTED.Id VALUES (${leaf}, ${sqlText(nfdName)}, 50, 1, 1)`);
  products.push(sqlProduct);
  assert.equal(sql(`SELECT ISNULL(SearchName, 'NULL') FROM Products WHERE Id=${sqlProduct}`), 'NULL');
  // (tokens avoid pure a-f words such as "da", which could match the hex tag of every fixture)
  for (const q of [`${tag} Nhẫn Lục`, `${tag} nhan da luc bao`, `${tag} LỤC BẢO`.normalize('NFD')]) assert.deepEqual(await searchIds(q), [sqlProduct], q);

  // Rename by SQL: the stale SearchName is repaired by the startup backfill of a freshly started API process.
  sql(`UPDATE Products SET Name = ${sqlText(`${tag} Ngọc Bích Hoàng Đế`)} WHERE Id=${p}`);
  if (process.env.CATALOG_SKIP_RESTART === '1') console.log('SKIP: restart backfill check (CATALOG_SKIP_RESTART=1)');
  else {
    restarted = await startSecondInstance();
    assert.deepEqual(await searchIds(`${tag} ngoc bich hoang de`, restartBase), [p]);
    assert.deepEqual(await searchIds(`${tag} kim cuong`, restartBase), [three]);
    assert.deepEqual(await searchIds(`${tag} nhan luc`, restartBase), [sqlProduct]);
    assert.equal(sql(`SELECT SearchName FROM Products WHERE Id=${p}`), `${tag} ngoc bich hoang de`);
    assert.equal(sql(`SELECT SearchName FROM Products WHERE Id=${sqlProduct}`), `${tag} nhan da luc bao`);
  }

  for (const query of ['page=0', 'minPrice=-1', 'minPrice=10&maxPrice=1', 'pageSize=49', 'sort=bad'])
    expect(await call(null, 'GET', `/products/catalog?${query}`), 400);
  expect(await call(a.token, 'POST', `/cart/items/${p}`, { quantity: 1 }), 200);
  expect(await call(a.token, 'POST', `/wishlist/${p}`), 200);
  expect(await call(admin.token, 'PUT', `/categories/${root}`, { name: tag, parentId: null, sortOrder: 0, isActive: false }), 204);
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
  console.log('PASS: hierarchy, sibling uniqueness, cycle/depth checks, PUT required fields, ancestor visibility, checkout rejection, Vietnamese token search, SQL-insert fallback, restart backfill, pagination clamp');
} finally {
  if (restarted && restarted.exitCode === null) {
    const exited = new Promise(r => restarted.once('exit', r));
    restarted.kill('SIGTERM'); await exited;
  }
  if (users.length) {
    const ids = users.join(',');
    sql(`DELETE FROM WishlistItems WHERE UserId IN (${ids}); DELETE FROM CartItems WHERE CartId IN (SELECT Id FROM Carts WHERE UserId IN (${ids})); DELETE FROM Carts WHERE UserId IN (${ids}); DELETE FROM Users WHERE Id IN (${ids});`);
  }
  if (products.length) sql(`DELETE FROM Products WHERE Id IN (${products.join(',')})`);
  for (const id of categories.reverse()) sql(`DELETE FROM Categories WHERE Id=${id}`);
  console.log('Temporary catalog fixtures cleaned up.');
}
