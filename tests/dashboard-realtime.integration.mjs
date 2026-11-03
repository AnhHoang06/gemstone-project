// Run against a local test/development database only. Creates and cleans up its own fixtures.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { HubConnectionBuilder, HttpTransportType, LogLevel } = require('@microsoft/signalr');
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

let hub;
try {
  const admin = await user('Admin'), customer = await user('Customer');
  categoryId = expect(await call(admin.token, 'POST', '/categories', { name: tag, isActive: true }), 201).id;
  const pid = await product(admin, 20, 1000000);
  const paths = ['', `&categoryId=${categoryId}`, `&categoryId=${categoryId}&productId=${pid}`];
  const analytics = async suffix => expect(await call(admin.token, 'GET', '/dashboard/analytics?range=30d' + suffix), 200);
  const detail = async id => expect(await call(customer.token, 'GET', `/orders/${id}`), 200);
  async function shipping(method) {
    expect(await call(customer.token, 'POST', `/cart/items/${pid}`, { quantity: 2 }), 200);
    const id = expect(await call(customer.token, 'POST', '/orders', { requestId: randomUUID(), recipientName: tag, recipientPhone: '0900000000', shippingAddress: 'Test only', paymentMethod: method }), 200).orderId;
    // develop has no bank-confirm API yet. Fixture represents money recognized before fulfilment.
    if(method === 'BankTransfer') sql(`UPDATE Orders SET PaymentStatus='Paid',PaidAt=SYSUTCDATETIME() WHERE Id=${id} AND UserId=${customer.id}`);
    for(const status of ['Confirmed','Shipping']) expect(await call(admin.token, 'PUT', `/orders/admin/${id}/status`, {status}),200);
    return id;
  }
  const bank = await shipping('BankTransfer');
  const before = await Promise.all(paths.map(analytics));
  let resolveEvent, rejectEvent;
  const notified = new Promise((resolve,reject) => { resolveEvent=resolve; rejectEvent=reject; });
  hub = new HubConnectionBuilder().withUrl(`${base}/hubs/orders`, { accessTokenFactory: () => admin.token, transport: HttpTransportType.WebSockets }).configureLogging(LogLevel.None).build();
  hub.on('OrderStatusChanged', async event => {
    if(event.orderId!==bank) return;
    try { resolveEvent({order:await detail(bank), reports:await Promise.all(paths.map(analytics))}); } catch(error) {rejectEvent(error);}
  });
  await hub.start();
  const stock=scalar(`SELECT Stock FROM Products WHERE Id=${pid}`);
  expect(await call(admin.token,'PUT',`/orders/admin/${bank}/status`,{status:'Completed'}),200);
  let timer;
  const observed=await Promise.race([notified,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Missing admin OrderStatusChanged')),5000);})]).finally(()=>clearTimeout(timer));
  assert.equal(observed.order.status,'Completed'); assert.equal(observed.order.paymentStatus,'Paid');
  assert.equal(scalar(`SELECT Stock FROM Products WHERE Id=${pid}`),stock);
  for(let i=0;i<paths.length;i++) {
    assert.equal(observed.reports[i].summary.revenue-before[i].summary.revenue,2000000);
    assert.equal(observed.reports[i].summary.completedOrders-before[i].summary.completedOrders,1);
    assert.equal(observed.reports[i].summary.unitsSold-before[i].summary.unitsSold,2);
    assert.equal(observed.reports[i].trend.reduce((s,r)=>s+r.revenue,0)-before[i].trend.reduce((s,r)=>s+r.revenue,0),2000000);
    assert.equal(observed.reports[i].breakdown.reduce((s,r)=>s+r.revenue,0)-before[i].breakdown.reduce((s,r)=>s+r.revenue,0),2000000);
  }
  console.log('PASS: real admin SignalR event sees committed Completed+Paid and KPI/trend/breakdown +2,000,000; count +1, units +2; All/category/product 30d filters; stock unchanged');
  const cod=await shipping('COD');
  assert.equal((await detail(cod)).paymentStatus,'Unpaid');
  const prior=await analytics(paths[2]);
  expect(await call(admin.token,'PUT',`/orders/admin/${cod}/status`,{status:'Completed'}),200);
  const codAfter=await detail(cod);
  assert.equal(codAfter.status,'Completed');
  assert.equal(codAfter.paymentStatus,'Unpaid','Current develop does not include the COD collection feature from PR #17');
  assert.equal((await analytics(paths[2])).summary.revenue,prior.summary.revenue);
  console.log('BASELINE LIMITATION confirmed: develop COD completion remains Unpaid, correctly excluded from revenue. PR #17 is a separate dependency.');
} finally {
  if(hub) await hub.stop();
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
