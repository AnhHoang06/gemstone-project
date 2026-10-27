// Run against a local test/development database only. Creates and cleans up its own fixtures.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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
