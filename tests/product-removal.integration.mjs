// Local test fixtures only; all created data is removed in finally.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const base = process.env.PRODUCT_API_URL || 'http://localhost:5113';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local API only');
const sql = q => execFileSync('sqlcmd', ['-S', process.env.PRODUCT_SQL_SERVER || '.\\SQLEXPRESS', '-d', process.env.PRODUCT_SQL_DATABASE || 'GemstoneShop', '-E', '-C', '-b', '-h', '-1', '-W', '-Q', `SET NOCOUNT ON; ${q}`], { encoding: 'utf8' }).trim();
const tag = `remove-${randomUUID().replaceAll('-', '')}`, users = [];
let productId, categoryId;
async function call(token, method, path, body) {
  const res = await fetch(`${base}/api${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const raw = await res.text(); let data; try { data = JSON.parse(raw); } catch { data = raw; }
  return { status: res.status, data };
}
const expect = (r, status) => { assert.equal(r.status, status, JSON.stringify(r.data)); return r.data; };
async function user(admin = false) {
  const email = `${tag}-${users.length}@example.invalid`, password = randomUUID() + '!aA9';
  expect(await call(null, 'POST', '/auth/register', { fullName: tag, email, password }), 200);
  const id = Number(sql(`SELECT Id FROM Users WHERE Email='${email}'`)); users.push(id);
  if (admin) sql(`UPDATE Users SET RoleId=(SELECT Id FROM Roles WHERE Name='Admin') WHERE Id=${id}`);
  return { id, ...expect(await call(null, 'POST', '/auth/login', { email, password }), 200) };
}
try {
  const admin = await user(true), customer = await user();
  categoryId = expect(await call(admin.token, 'POST', '/categories', { name: tag, isActive: true }), 201).id;
  const dto = { categoryId, name: tag, price: 123, stock: 5, isActive: true };
  productId = expect(await call(admin.token, 'POST', '/products', dto), 201).id;
  expect(await call(admin.token, 'PUT', `/products/${productId}`, dto), 204);
  const certificate = { certificateNumber: tag, authority: 'Test' };
  expect(await call(admin.token, 'PUT', `/products/${productId}/certificate`, certificate), 200);
  sql(`INSERT INTO ProductImages(ProductId,ImageUrl,IsPrimary,SortOrder) VALUES(${productId},'/uploads/${tag}.png',1,0)`);
  const imageId = Number(sql(`SELECT Id FROM ProductImages WHERE ProductId=${productId}`));
  expect(await call(admin.token, 'PUT', `/products/${productId}/images/${imageId}/set-primary`), 204);
  expect(await call(customer.token, 'POST', `/cart/items/${productId}`, { quantity: 1 }), 200);
  const orderId = expect(await call(customer.token, 'POST', '/orders', { requestId: randomUUID(), recipientName: 'Test', recipientPhone: '0900000000', shippingAddress: 'Test' }), 200).orderId;
  expect(await call(customer.token, 'POST', `/cart/items/${productId}`, { quantity: 1 }), 200);
  const before = expect(await call(customer.token, 'GET', `/orders/${orderId}`), 200);
  for (const token of [null, admin.token]) assert.ok(expect(await call(token, 'GET', '/products'), 200).some(p => p.id === productId));
  expect(await call(null, 'DELETE', `/products/${productId}`), 401);
  expect(await call(customer.token, 'DELETE', `/products/${productId}`), 403);
  expect(await call(admin.token, 'DELETE', `/products/${productId}`), 204);
  expect(await call(admin.token, 'DELETE', `/products/${productId}`), 204);
  assert.equal(Number(sql(`SELECT COUNT(*) FROM Products WHERE Id=${productId} AND IsActive=0`)), 1);
  for (const token of [null, admin.token]) {
    assert.equal(expect(await call(token, 'GET', '/products'), 200).some(p => p.id === productId), false);
    expect(await call(token, 'GET', `/products/${productId}`), 404);
  }
  expect(await call(admin.token, 'PUT', `/products/${productId}`, { ...dto, name: 'Must not change' }), 404);
  for (const table of ['ProductImages', 'Certificates', 'CartItems', 'OrderDetails'])
    assert.equal(Number(sql(`SELECT COUNT(*) FROM ${table} WHERE ProductId=${productId}`)), 1);
  assert.deepEqual(expect(await call(customer.token, 'GET', `/orders/${orderId}`), 200), before);
  assert.equal(expect(await call(admin.token, 'GET', `/orders/admin/${orderId}`), 200).items[0].productId, productId);
  console.log('PASS: active CRUD; authorized soft deletion; admin/public filtering; inactive edit guards; Product/image/certificate/cart/order references preserved.');
} finally {
  if (users.length) {
    const ids = users.join(',');
    sql(`DELETE FROM CheckoutReceipts WHERE UserId IN (${ids}); DELETE FROM OrderDetails WHERE OrderId IN (SELECT Id FROM Orders WHERE UserId IN (${ids})); DELETE FROM Orders WHERE UserId IN (${ids}); DELETE FROM CartItems WHERE CartId IN (SELECT Id FROM Carts WHERE UserId IN (${ids})); DELETE FROM Carts WHERE UserId IN (${ids}); DELETE FROM Users WHERE Id IN (${ids}) AND FullName='${tag}';`);
  }
  if (productId) sql(`DELETE FROM ProductImages WHERE ProductId=${productId}; DELETE FROM Certificates WHERE ProductId=${productId}; DELETE FROM Products WHERE Id=${productId} AND Name='${tag}'`);
  if (categoryId) sql(`DELETE FROM Categories WHERE Id=${categoryId} AND Name='${tag}'`);
  console.log('Temporary product fixtures cleaned up.');
}
