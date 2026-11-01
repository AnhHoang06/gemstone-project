// Run against a local test/development database only. Creates and cleans up its own fixtures.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { HubConnectionBuilder, HttpTransportType, LogLevel } = require('@microsoft/signalr');
const connections = [];
import { randomUUID } from 'node:crypto';
const base = process.env.PERSON3_API_URL || 'http://localhost:5113';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Only local test APIs are allowed');
const tag = `payment-${randomUUID().replaceAll('-', '')}`;
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

try {
  const admin = await user('Admin'), a = await user('Customer'), b = await user('Customer');
  categoryId = expect(await call(admin.token, 'POST', '/categories', { name: tag, isActive: true }), 201).id;
  const p = await product(admin, 10, 1000000);
  const request = method => ({ requestId: randomUUID(), recipientName: tag, recipientPhone: '0900000000', shippingAddress: 'Test', paymentMethod: method });
  for (const method of ['COD', 'BankTransfer']) {
    expect(await call(a.token, 'POST', `/cart/items/${p}`, { quantity: 2 }), 200);
    const body = request(method);
    expect(await call(a.token, 'POST', '/orders', { ...body, paymentMethod: 'Visa' }), 400);
    const responses = await Promise.all([call(a.token, 'POST', '/orders', body), call(a.token, 'POST', '/orders', body)]);
    responses.forEach(r => expect(r, 200));
    const id = responses[0].data.orderId;
    assert.equal(id, responses[1].data.orderId);
    assert.equal(responses[1].data.paymentMethod, method);
    const detail = expect(await call(a.token, 'GET', `/orders/${id}`), 200);
    assert.equal(detail.paymentMethod, method); assert.equal(detail.paymentStatus, 'Unpaid'); assert.equal(detail.paidAt, null);
    assert.equal(detail.totalAmount, 2000000);
    assert.equal(scalar(`SELECT COUNT(*) FROM Orders WHERE Id=${id}`), 1);
    expect(await call(null, 'GET', `/orders/${id}/payment`), 401);
    expect(await call(b.token, 'GET', `/orders/${id}/payment`), 404);
    const payment = expect(await call(a.token, 'GET', `/orders/${id}/payment`), 200);
    assert.equal(payment.transferContent, `DH${id}`);
    if (!payment.bankConfigured) assert.equal(payment.accountNumber, null);
    const mismatch = await call(a.token, 'POST', '/orders', { ...body, paymentMethod: method === 'COD' ? 'BankTransfer' : 'COD' });
    assert.equal(expect(mismatch, 409).code, 'request_mismatch');
    expect(await call(a.token, 'PUT', `/orders/${id}/cancel`), 200);
    assert.equal(scalar(`SELECT Stock FROM Products WHERE Id=${p}`), 10);
    assert.equal(expect(await call(a.token, 'GET', `/orders/${id}`), 200).paymentStatus, 'Unpaid');
    console.log(`PASS: ${method}, Unpaid, duplicate checkout, amount, ownership, mismatch, cancellation`);
  }
  const admin2 = await user('Admin');
  const p2 = await product(admin, 100, 1000000);
  const detail = async id => expect(await call(a.token, 'GET', `/orders/${id}`), 200);
  const revenue = async () => expect(await call(admin.token, 'GET', '/dashboard/summary'), 200).totalRevenue;
  const initialRevenue = await revenue();
  async function create(method) {
    expect(await call(a.token, 'POST', `/cart/items/${p2}`, { quantity: 1 }), 200);
    const id = expect(await call(a.token, 'POST', '/orders', request(method)), 200).orderId;
    const o = await detail(id);
    assert.equal(o.status, 'Pending'); assert.equal(o.paymentStatus, 'Unpaid');
    assert.equal(o.paymentReportedAt, null); assert.equal(o.paidAt, null);
    return id;
  }
  const changed = [];
  const hub = new HubConnectionBuilder().withUrl(`${base}/hubs/orders`, { accessTokenFactory: () => a.token, transport: HttpTransportType.WebSockets }).configureLogging(LogLevel.None).build();
  hub.on('OrderStatusChanged', event => changed.push(event.orderId));
  connections.push(hub); await hub.start();
  const bankId = await create('BankTransfer');
  expect(await call(a.token, 'POST', `/orders/admin/${bankId}/confirm-payment`), 403);
  expect(await call(null, 'POST', `/orders/admin/${bankId}/confirm-payment`), 401);
  expect(await call(b.token, 'POST', `/orders/${bankId}/payment-reported`), 404);
  expect(await call(admin.token, 'POST', '/orders/admin/2147483647/confirm-payment'), 404);
  expect(await call(a.token, 'POST', '/orders/2147483647/payment-reported'), 404);
  expect(await call(admin.token, 'PUT', `/orders/admin/${bankId}/status`, { status: 'Confirmed' }), 409);
  assert.equal(await revenue(), initialRevenue);
  const report = expect(await call(a.token, 'POST', `/orders/${bankId}/payment-reported`, { paymentStatus: 'Paid' }), 200);
  assert.ok(report.paymentReportedAt); assert.equal(report.paymentStatus, 'Unpaid'); assert.equal(report.status, 'Pending');
  const reported = await detail(bankId);
  assert.equal(reported.paymentReportedAt, report.paymentReportedAt); assert.equal(reported.paidAt, null);
  assert.equal(expect(await call(a.token, 'POST', `/orders/${bankId}/payment-reported`), 200).paymentReportedAt, report.paymentReportedAt);
  assert.equal(await revenue(), initialRevenue, 'Reported money is not revenue');
  const stockBefore = scalar(`SELECT Stock FROM Products WHERE Id=${p2}`);
  const confirmations = await Promise.all([admin, admin2].map(u => call(u.token, 'POST', `/orders/admin/${bankId}/confirm-payment`)));
  confirmations.forEach(r => expect(r, 200));
  assert.equal(confirmations.filter(r => r.data.replayed === false).length, 1);
  const paid = await detail(bankId);
  assert.equal(paid.paymentStatus, 'Paid'); assert.equal(paid.status, 'Confirmed'); assert.ok(paid.paidAt);
  assert.equal(scalar(`SELECT Stock FROM Products WHERE Id=${p2}`), stockBefore);
  assert.equal(expect(await call(admin.token, 'POST', `/orders/admin/${bankId}/confirm-payment`), 200).paidAt, paid.paidAt);
  expect(await call(admin.token, 'PUT', `/orders/admin/${bankId}/status`, { status: 'Cancelled' }), 409);
  assert.equal(await revenue(), initialRevenue, 'Paid but not fulfilled is not recognized revenue');
  for (let i = 0; i < 30 && changed.filter(x => x === bankId).length < 2; i++) await new Promise(r => setTimeout(r, 100));
  assert.equal(changed.filter(x => x === bankId).length, 2, 'One report + one confirm event, no duplicate publications');
  for (const status of ['Shipping', 'Completed']) expect(await call(admin.token, 'PUT', `/orders/admin/${bankId}/status`, { status }), 200);
  assert.equal((await detail(bankId)).paidAt, paid.paidAt);
  assert.equal(await revenue(), initialRevenue + 1000000);
  console.log('PASS: bank report persisted/unpaid; atomic two-admin confirm; PaidAt stable; secure ownership; realtime; completed+paid revenue');

  const codId = await create('COD');
  expect(await call(admin.token, 'POST', `/orders/admin/${codId}/confirm-payment`), 409);
  expect(await call(a.token, 'POST', `/orders/${codId}/payment-reported`), 409);
  for (const status of ['Confirmed', 'Shipping']) {
    expect(await call(admin.token, 'PUT', `/orders/admin/${codId}/status`, { status }), 200);
    assert.equal((await detail(codId)).paymentStatus, 'Unpaid');
    assert.equal(await revenue(), initialRevenue + 1000000);
  }
  await Promise.all([admin, admin2].map(async u => expect(await call(u.token, 'PUT', `/orders/admin/${codId}/status`, { status: 'Completed' }), 200)));
  const cod = await detail(codId); assert.equal(cod.paymentStatus, 'Paid'); assert.ok(cod.paidAt);
  expect(await call(admin.token, 'PUT', `/orders/admin/${codId}/status`, { status: 'Completed' }), 200);
  assert.equal((await detail(codId)).paidAt, cod.paidAt);
  assert.equal(await revenue(), initialRevenue + 2000000);
  console.log('PASS: COD Pending/Confirmed/Shipping remain Unpaid; completion atomically collects once and adds revenue');

  const unpaid = await create('BankTransfer');
  assert.equal((await detail(unpaid)).status, 'Pending'); assert.equal((await detail(unpaid)).paymentStatus, 'Unpaid');
  expect(await call(a.token, 'POST', `/orders/${unpaid}/payment-reported`), 200);
  const beforeCancel = scalar(`SELECT Stock FROM Products WHERE Id=${p2}`);
  const cancels = await Promise.all([call(a.token, 'PUT', `/orders/${unpaid}/cancel`), call(a.token, 'PUT', `/orders/${unpaid}/cancel`)]);
  cancels.forEach(r => expect(r, 200));
  assert.equal(scalar(`SELECT Stock FROM Products WHERE Id=${p2}`), beforeCancel + 1);
  expect(await call(admin.token, 'POST', `/orders/admin/${unpaid}/confirm-payment`), 409);
  expect(await call(a.token, 'POST', `/orders/${unpaid}/payment-reported`), 409);
  const raceId = await create('BankTransfer'), raceStock = scalar(`SELECT Stock FROM Products WHERE Id=${p2}`);
  const race = await Promise.all([call(admin.token, 'POST', `/orders/admin/${raceId}/confirm-payment`), call(a.token, 'PUT', `/orders/${raceId}/cancel`)]);
  assert.deepEqual(race.map(r => r.status).sort(), [200, 409]);
  const raceOrder = await detail(raceId);
  assert.equal(raceOrder.paymentStatus, raceOrder.status === 'Cancelled' ? 'Unpaid' : 'Paid');
  assert.equal(scalar(`SELECT Stock FROM Products WHERE Id=${p2}`), raceStock + (raceOrder.status === 'Cancelled' ? 1 : 0));
  assert.equal(await revenue(), initialRevenue + 2000000);
  console.log('PASS: cancelled report/confirm rejected; cancel/cancel and cancel/confirm races restore stock at most once');

  expect(await call(a.token, 'POST', `/cart/items/${p}`, { quantity: 1 }), 200);
  const legacy = request(undefined);
  const created = expect(await call(a.token, 'POST', '/orders', legacy), 200);
  assert.equal(created.paymentMethod, 'COD');
  // Simulate an existing pre-payment order: old receipt/hash remains unchanged.
  sql(`UPDATE Orders SET PaymentMethod=NULL, PaymentStatus=NULL WHERE Id=${created.orderId}`);
  const replay = expect(await call(a.token, 'POST', '/orders', legacy), 200);
  assert.equal(replay.orderId, created.orderId); assert.equal(replay.paymentMethod, null);
  console.log('PASS: legacy no-payment request/receipt remains replayable without backfilling history');
} finally {
  await Promise.all(connections.map(c => c.stop()));
  if (users.length) {
    const ids = users.join(',');
    sql(`DELETE FROM CheckoutReceipts WHERE UserId IN (${ids});
      DELETE FROM OrderDetails WHERE OrderId IN (SELECT Id FROM Orders WHERE UserId IN (${ids}));
      DELETE FROM Orders WHERE UserId IN (${ids});
      DELETE FROM CartItems WHERE CartId IN (SELECT Id FROM Carts WHERE UserId IN (${ids}));
      DELETE FROM Carts WHERE UserId IN (${ids}); DELETE FROM Users WHERE Id IN (${ids});`);
  }
  if (products.length) sql(`DELETE FROM Products WHERE Id IN (${products.join(',')}) AND Name='${tag}'`);
  if (categoryId) sql(`DELETE FROM Categories WHERE Id=${categoryId} AND Name='${tag}'`);
  console.log('Temporary payment fixtures cleaned up.');
}
