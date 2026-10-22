// Run against a local test/development database only. Creates and cleans up its own fixtures.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { HubConnectionBuilder, HttpTransportType, LogLevel } = require('@microsoft/signalr');
const base = process.env.PERSON3_API_URL || 'http://localhost:5113';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Only local test APIs are allowed');
const tag = `p3-${randomUUID().replaceAll('-', '')}`;
const users = [], products = [], connections = [];
let categoryId, triggerCreated = false;
const trigger = `test_${tag.replaceAll('-', '_')}`;
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
async function product(admin, stock) {
  const p = expect(await call(admin.token, 'POST', '/products', { categoryId, name: tag, price: 123, stock, isActive: true }), 201);
  products.push(p.id); return p.id;
}
const checkoutBody = () => ({ requestId: randomUUID(), recipientName: 'Test', recipientPhone: '0900000000', shippingAddress: 'Local test', note: tag });
const cart = async u => expect(await call(u.token, 'GET', '/cart'), 200);
const add = async (u, id, quantity = 1) => expect(await call(u.token, 'POST', `/cart/items/${id}`, { quantity, price: 0, userId: -1 }), 200);
const clear = async u => expect(await call(u.token, 'DELETE', '/cart'), 200);
const order = async (u, body = checkoutBody()) => expect(await call(u.token, 'POST', '/orders', body), 200).orderId;
const stock = id => scalar(`SELECT Stock FROM Products WHERE Id=${id}`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate) { for (let i = 0; i < 50; i++) { if (predicate()) return; await sleep(100); } assert.fail('Realtime event timeout'); }
async function hub(u) {
  const events = [];
  const connection = new HubConnectionBuilder().withUrl(`${base}/hubs/orders`, { accessTokenFactory: () => u.token, transport: HttpTransportType.WebSockets }).configureLogging(LogLevel.None).withAutomaticReconnect().build();
  for (const name of ['NewOrder', 'OrderStatusChanged']) connection.on(name, data => events.push({ name, ...data }));
  connections.push(connection); await connection.start();
  return { connection, events };
}
function pass(name) { console.log(`PASS: ${name}`); }

try {
  const admin = await user('Admin'), a = await user('Customer'), b = await user('Customer');
  categoryId = expect(await call(admin.token, 'POST', '/categories', { name: tag, isActive: true }), 201).id;
  const p = await product(admin, 50);
  expect(await call(null, 'GET', '/cart'), 401);
  expect(await call(a.token, 'GET', '/orders/admin'), 403);
  expect(await call(a.token, 'PUT', '/orders/admin/1/status', { status: 'Confirmed' }), 403);
  expect(await call(a.token, 'POST', `/cart/items/${p}`, { quantity: 0 }), 400);
  const adds = await Promise.all(Array.from({ length: 10 }, () => call(a.token, 'POST', `/cart/items/${p}`, { quantity: 1 })));
  adds.forEach(r => expect(r, 200));
  assert.equal((await cart(a)).items[0].quantity, 10);
  assert.equal((await cart(b)).items.length, 0);
  expect(await call(b.token, 'PUT', `/cart/items/${p}`, { quantity: 3, userId: a.id }), 404);
  assert.equal((await cart(a)).items[0].quantity, 10);
  pass('Concurrent cart increments, one cart/item, and user isolation');

  const ha = await hub(a), hb = await hub(b), hm = await hub(admin);
  await assert.rejects(ha.connection.invoke('JoinGroup', `orders:user:${b.id}`));
  const body = checkoutBody();
  const pair = await Promise.all([call(a.token, 'POST', '/orders', body), call(a.token, 'POST', '/orders', body)]);
  pair.forEach(r => expect(r, 200));
  const id = pair[0].data.orderId;
  assert.equal(pair[1].data.orderId, id); assert.equal(stock(p), 40);
  assert.equal((await cart(a)).items.length, 0);
  assert.equal(expect(await call(a.token, 'GET', `/orders/${id}`), 200).totalAmount, 1230);
  expect(await call(b.token, 'GET', `/orders/${id}`), 404);
  expect(await call(b.token, 'PUT', `/orders/${id}/cancel`), 404);
  expect(await call(a.token, 'POST', '/orders', { ...body, recipientName: 'Different' }), 409);
  await until(() => hm.events.some(e => e.name === 'NewOrder' && e.orderId === id));
  assert.equal(ha.events.filter(e => e.name === 'NewOrder').length, 0);
  assert.equal(hb.events.length, 0);
  pass('Checkout replay creates one order, server price, ownership and admin-only NewOrder');

  const cancels = await Promise.all([call(a.token, 'PUT', `/orders/${id}/cancel`), call(a.token, 'PUT', `/orders/${id}/cancel`)]);
  cancels.forEach(r => expect(r, 200)); assert.equal(stock(p), 50);
  await until(() => ha.events.some(e => e.name === 'OrderStatusChanged' && e.orderId === id));
  await until(() => hm.events.some(e => e.name === 'OrderStatusChanged' && e.orderId === id));
  assert.equal(hb.events.length, 0);
  pass('Double cancellation restores stock once; status events go only to owner/admin');

  const last = await product(admin, 1);
  await add(a, last); await add(b, last);
  const race = await Promise.all([call(a.token, 'POST', '/orders', checkoutBody()), call(b.token, 'POST', '/orders', checkoutBody())]);
  assert.deepEqual(race.map(r => r.status).sort(), [200, 409]); assert.equal(stock(last), 0);
  await clear(a); await clear(b);
  pass('Two customers racing for last unit never oversell');

  await add(a, p);
  const raceOrder = await order(a);
  const transitions = await Promise.all([call(a.token, 'PUT', `/orders/${raceOrder}/cancel`), call(admin.token, 'PUT', `/orders/admin/${raceOrder}/status`, { status: 'Confirmed' })]);
  assert.deepEqual(transitions.map(r => r.status).sort(), [200, 409]);
  const raceStatus = expect(await call(a.token, 'GET', `/orders/${raceOrder}`), 200).status;
  assert.equal(stock(p), raceStatus === 'Cancelled' ? 50 : 49);
  expect(await call(admin.token, 'PUT', `/orders/admin/${raceOrder}/status`, { status: 'Cancelled' }), 200);
  assert.equal(stock(p), 50);
  pass('Cancel versus confirm remains consistent; admin can cancel Confirmed once');

  const second = await product(admin, 3);
  await add(a, p); await add(a, second);
  // Fixture setup only: independent of the unrelated Product soft-delete endpoints.
  sql(`UPDATE Products SET IsActive=0 WHERE Id=${second} AND Name='${tag}'`);
  expect(await call(b.token, 'POST', `/cart/items/${second}`, { quantity: 1 }), 409);
  assert.equal((await cart(b)).items.length, 0);
  const before = scalar(`SELECT COUNT(*) FROM Orders WHERE UserId=${a.id}`);
  const rollbackRequest = checkoutBody();
  expect(await call(a.token, 'POST', '/orders', rollbackRequest), 409);
  assert.equal(stock(p), 50); assert.equal((await cart(a)).items.length, 2);
  assert.equal(scalar(`SELECT COUNT(*) FROM Orders WHERE UserId=${a.id}`), before);
  sql(`UPDATE Products SET IsActive=1 WHERE Id=${second} AND Name='${tag}'`);
  await clear(a);
  pass('Failure on later item rolls back earlier stock deduction and preserves cart');

  await add(a, p);
  // Fault injection after Order insert/cart delete, scoped ONLY to this fixture user.
  sql(`EXEC('CREATE TRIGGER dbo.${trigger} ON dbo.CheckoutReceipts AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE UserId=${a.id}) THROW 51002, ''Test rollback'', 1; END');`);
  triggerCreated = true;
  const failBody = checkoutBody();
  const failed = await call(a.token, 'POST', '/orders', failBody);
  assert.equal(failed.status, 500);
  assert.equal(stock(p), 50); assert.equal((await cart(a)).items[0].quantity, 1);
  assert.equal(scalar(`SELECT COUNT(*) FROM Orders WHERE UserId=${a.id}`), before);
  sql(`DROP TRIGGER dbo.${trigger}`); triggerCreated = false;
  const retryId = await order(a, failBody);
  assert.equal(await order(a, failBody), retryId);
  pass('Failure after order insertion rolls back entire checkout; retry succeeds exactly once');

  expect(await call(admin.token, 'PUT', `/orders/admin/${retryId}/status`, { status: 'Shipping' }), 409);
  for (const status of ['Confirmed', 'Shipping', 'Completed']) expect(await call(admin.token, 'PUT', `/orders/admin/${retryId}/status`, { status }), 200);
  expect(await call(a.token, 'PUT', `/orders/${retryId}/cancel`), 409);
  expect(await call(admin.token, 'PUT', `/orders/admin/${retryId}/status`, { status: 'Cancelled' }), 409);
  pass('Legal status chain enforced, Completed cannot be cancelled');

  await add(a, p);
  const stockBefore = stock(p);
  const mutationRace = await Promise.all([call(a.token, 'POST', '/orders', checkoutBody()), call(a.token, 'POST', `/cart/items/${p}`, { quantity: 1 })]);
  mutationRace.forEach(r => expect(r, 200));
  const detail = expect(await call(a.token, 'GET', `/orders/${mutationRace[0].data.orderId}`), 200);
  const remaining = (await cart(a)).totalQuantity;
  assert.equal(detail.items[0].quantity + remaining, 2);
  assert.equal(stock(p), stockBefore - detail.items[0].quantity);
  pass('Cart mutation versus checkout has a serial, lossless result');

  const revokedAdmin = await user('Admin'), hr = await hub(revokedAdmin);
  await clear(a); await add(a, p);
  const revocationOrder = await order(a);
  await until(() => hr.events.some(e => e.name === 'NewOrder' && e.orderId === revocationOrder));
  sql(`UPDATE Users SET IsActive=0 WHERE Id IN (${a.id},${revokedAdmin.id})`);
  expect(await call(a.token, 'GET', '/cart'), 401);
  expect(await call(admin.token, 'PUT', `/orders/admin/${revocationOrder}/status`, { status: 'Confirmed' }), 200);
  await until(() => hm.events.some(e => e.name === 'OrderStatusChanged' && e.orderId === revocationOrder));
  await add(b, p);
  const otherOrder = await order(b);
  await until(() => hm.events.some(e => e.name === 'NewOrder' && e.orderId === otherOrder));
  await sleep(500);
  assert.equal(ha.connection.state, 'Connected');
  assert.equal(hr.connection.state, 'Connected');
  assert.equal(ha.events.some(e => e.name === 'OrderStatusChanged' && e.orderId === revocationOrder), false);
  assert.equal(hr.events.some(e => e.name === 'OrderStatusChanged' && e.orderId === revocationOrder), false);
  assert.equal(hr.events.some(e => e.name === 'NewOrder' && e.orderId === otherOrder), false);
  sql(`UPDATE Users SET IsActive=1 WHERE Id IN (${a.id},${revokedAdmin.id})`);
  expect(await call(a.token, 'GET', '/cart'), 200);
  expect(await call(admin.token, 'PUT', `/orders/admin/${revocationOrder}/status`, { status: 'Shipping' }), 200);
  await until(() => ha.events.some(e => e.name === 'OrderStatusChanged' && e.orderId === revocationOrder));
  await until(() => hr.events.some(e => e.name === 'OrderStatusChanged' && e.orderId === revocationOrder));
  pass('Established WebSockets exclude inactive owner/admin; reactivation restores delivery');

  sql(`UPDATE Users SET IsActive=0 WHERE Id=${b.id}`);
  expect(await call(b.token, 'GET', '/cart'), 401);
  const disabled = new HubConnectionBuilder().withUrl(`${base}/hubs/orders`, { accessTokenFactory: () => b.token, transport: HttpTransportType.LongPolling }).configureLogging(LogLevel.None).build();
  await assert.rejects(disabled.start());
  pass('Inactive account blocked by HTTP and hub authentication');
} finally {
  await Promise.all(connections.map(c => c.stop()));
  if (triggerCreated) sql(`DROP TRIGGER dbo.${trigger}`);
  if (users.length) {
    const ids = users.join(',');
    sql(`DELETE FROM CheckoutReceipts WHERE UserId IN (${ids});
      DELETE FROM OrderDetails WHERE OrderId IN (SELECT Id FROM Orders WHERE UserId IN (${ids}));
      DELETE FROM Orders WHERE UserId IN (${ids});
      DELETE FROM CartItems WHERE CartId IN (SELECT Id FROM Carts WHERE UserId IN (${ids}));
      DELETE FROM Carts WHERE UserId IN (${ids});
      DELETE FROM Users WHERE Id IN (${ids});`);
  }
  if (products.length) sql(`DELETE FROM Products WHERE Id IN (${products.join(',')}) AND Name='${tag}'`);
  if (categoryId) sql(`DELETE FROM Categories WHERE Id=${categoryId} AND Name='${tag}'`);
  console.log('Temporary fixtures cleaned up.');
}
