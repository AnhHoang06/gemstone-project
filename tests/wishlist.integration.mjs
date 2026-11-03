// Local development/test DB only. Never target a shared production database.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const base = process.env.WISHLIST_API_URL || 'http://localhost:5113';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Only local test APIs are allowed');
const sqlArgs = ['-S', process.env.WISHLIST_SQL_SERVER || '.\\SQLEXPRESS', '-d', process.env.WISHLIST_SQL_DATABASE || 'GemstoneShop', '-E', '-C', '-b', '-h', '-1', '-W'];
const sql = query => execFileSync('sqlcmd', [...sqlArgs, '-Q', `SET NOCOUNT ON; ${query}`], { encoding: 'utf8' }).trim();
const scalar = query => Number(sql(query));
const script = fileURLToPath(new URL('../backend/GemstoneShop/GemstoneShop/Database/Wishlist.sql', import.meta.url));
const tag = `wish-${randomUUID().replaceAll('-', '')}`;
const users = [];
let categoryId, productId;
async function call(token, method, path, body) {
  const res = await fetch(`${base}/api${path}`, { method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  const raw = await res.text(); let data; try { data = JSON.parse(raw); } catch { data = raw; }
  return { status: res.status, data };
}
function expect(response, status) { assert.equal(response.status, status, JSON.stringify(response.data)); return response.data; }
async function user(admin = false) {
  const email = `${tag}-${users.length}@example.invalid`, password = `${randomUUID()}!aA9`;
  expect(await call(null, 'POST', '/auth/register', { fullName: tag, email, password }), 200);
  const id = scalar(`SELECT Id FROM Users WHERE Email='${email}'`); users.push(id);
  if (admin) sql(`UPDATE Users SET RoleId=(SELECT Id FROM Roles WHERE Name='Admin') WHERE Id=${id}`);
  return { id, ...expect(await call(null, 'POST', '/auth/login', { email, password }), 200) };
}
const pass = message => console.log(`PASS: ${message}`);

try {
  const admin = await user(true), a = await user(), b = await user();
  categoryId = expect(await call(admin.token, 'POST', '/categories', { name: tag, isActive: true }), 201).id;
  productId = expect(await call(admin.token, 'POST', '/products', { categoryId, name: tag, price: 1000000, stock: 5, isActive: true }), 201).id;
  const count = () => scalar(`SELECT COUNT(*) FROM WishlistItems WHERE UserId=${a.id} AND ProductId=${productId}`);
  for (const method of ['GET', 'POST', 'DELETE']) expect(await call(null, method, method === 'GET' ? '/wishlist' : `/wishlist/${productId}`), 401);
  expect(await call(a.token, 'POST', '/wishlist/2147483647'), 404);
  const saved = expect(await call(a.token, 'POST', `/wishlist/${productId}`, { userId: b.id }), 200);
  assert.equal(saved.length, 1); assert.equal(saved[0].id, productId); assert.equal(saved[0].price, 1000000);
  assert.equal(saved[0].userId, undefined); assert.equal(saved[0].passwordHash, undefined);
  assert.equal(count(), 1);
  assert.deepEqual(expect(await call(b.token, 'GET', `/wishlist?userId=${a.id}`), 200), []);
  expect(await call(b.token, 'DELETE', `/wishlist/${productId}?userId=${a.id}`), 200);
  assert.equal(count(), 1);
  pass('JWT ownership, anonymous rejection, missing product, minimal DTO and cross-user isolation');

  const created = sql(`SELECT CONVERT(varchar(33),CreatedAt,126) FROM WishlistItems WHERE UserId=${a.id} AND ProductId=${productId}`);
  const adds = await Promise.all(Array.from({ length: 12 }, () => call(a.token, 'POST', `/wishlist/${productId}`)));
  adds.forEach(r => { assert.equal(expect(r, 200).length, 1); });
  assert.equal(count(), 1);
  assert.equal(sql(`SELECT CONVERT(varchar(33),CreatedAt,126) FROM WishlistItems WHERE UserId=${a.id} AND ProductId=${productId}`), created);
  pass('Concurrent duplicate adds keep exactly one row and preserve CreatedAt');

  execFileSync('sqlcmd', [...sqlArgs, '-i', script], { encoding: 'utf8' });
  execFileSync('sqlcmd', [...sqlArgs, '-i', script], { encoding: 'utf8' });
  assert.equal(count(), 1);
  assert.equal(scalar(`BEGIN TRY INSERT INTO WishlistItems(UserId,ProductId) VALUES(${a.id},${productId}); SELECT 0; END TRY BEGIN CATCH SELECT ERROR_NUMBER(); END CATCH`), 2627);
  assert.equal(scalar(`BEGIN TRY INSERT INTO WishlistItems(UserId,ProductId) VALUES(-2147483648,${productId}); SELECT 0; END TRY BEGIN CATCH SELECT ERROR_NUMBER(); END CATCH`), 547);
  assert.equal(scalar(`BEGIN TRY INSERT INTO WishlistItems(UserId,ProductId) VALUES(${a.id},2147483647); SELECT 0; END TRY BEGIN CATCH SELECT ERROR_NUMBER(); END CATCH`), 547);
  pass('Additive schema reruns preserve favorites; database enforces uniqueness and both foreign keys');

  sql(`UPDATE Products SET IsActive=0 WHERE Id=${productId} AND Name='${tag}'`);
  assert.deepEqual(expect(await call(a.token, 'GET', '/wishlist'), 200), []);
  assert.equal(count(), 1);
  expect(await call(b.token, 'POST', `/wishlist/${productId}`), 409);
  sql(`UPDATE Products SET IsActive=1 WHERE Id=${productId} AND Name='${tag}'`);
  assert.equal(expect(await call(a.token, 'GET', '/wishlist'), 200)[0].id, productId);
  sql(`UPDATE Products SET IsActive=0 WHERE Id=${productId} AND Name='${tag}'`);
  expect(await call(a.token, 'DELETE', `/wishlist/${productId}`), 200);
  assert.equal(count(), 0);
  sql(`UPDATE Products SET IsActive=1 WHERE Id=${productId} AND Name='${tag}'`);
  pass('Inactive rows stay hidden and reappear on reactivation; hidden favorites can also be removed');

  const mixed = await Promise.all(Array.from({ length: 12 }, (_, index) => call(a.token, index % 2 ? 'POST' : 'DELETE', `/wishlist/${productId}`)));
  mixed.forEach(r => expect(r, 200)); assert.ok(count() <= 1);
  expect(await call(a.token, 'POST', `/wishlist/${productId}`), 200);
  const removes = await Promise.all(Array.from({ length: 8 }, () => call(a.token, 'DELETE', `/wishlist/${productId}`)));
  removes.forEach(r => assert.deepEqual(expect(r, 200), [])); assert.equal(count(), 0);
  pass('Concurrent add/remove and duplicate removals are safe and idempotent');

  sql(`UPDATE Users SET IsActive=0 WHERE Id=${a.id}`);
  for (const method of ['GET', 'POST', 'DELETE']) expect(await call(a.token, method, method === 'GET' ? '/wishlist' : `/wishlist/${productId}`), 401);
  pass('Existing JWT active-account revocation applies to every wishlist endpoint');
} finally {
  if (users.length) sql(`DELETE FROM WishlistItems WHERE UserId IN (${users.join(',')}); DELETE FROM Users WHERE Id IN (${users.join(',')}) AND FullName='${tag}';`);
  if (productId) sql(`DELETE FROM Products WHERE Id=${productId} AND Name='${tag}'`);
  if (categoryId) sql(`DELETE FROM Categories WHERE Id=${categoryId} AND Name='${tag}'`);
  console.log('Temporary wishlist fixtures cleaned up.');
}
