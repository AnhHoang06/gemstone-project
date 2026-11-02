// Run against a local test/development database only. Creates and cleans up its own fixtures.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const {HubConnectionBuilder,HttpTransportType,LogLevel}=require('@microsoft/signalr');
const connections=[];
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
  const admin=await user('Admin'), a=await user('Customer'), b=await user('Customer');
  categoryId=expect(await call(admin.token,'POST','/categories',{name:tag,isActive:true}),201).id;
  const pid=await product(admin,100,1000000);
  const form={recipientName:'  Recipient Updated  ',recipientPhone:'  +84 901234567  ',shippingAddress:'  New address  ',note:'  Doorbell  '};
  const detail=async id=>expect(await call(a.token,'GET',`/orders/${id}`),200);
  const update=(who,id,body=form,isAdmin=false)=>call(who?.token,'PUT',`/orders/${isAdmin?'admin/':''}${id}/shipping-info`,body);
  async function create() {
    expect(await call(a.token,'POST',`/cart/items/${pid}`,{quantity:2}),200);
    return expect(await call(a.token,'POST','/orders',{requestId:randomUUID(),recipientName:tag,recipientPhone:'0900000000',shippingAddress:'Original',paymentMethod:'COD'}),200).orderId;
  }
  const status=(id,value)=>call(admin.token,'PUT',`/orders/admin/${id}/status`,{status:value});
  const preserved=o=>Object.fromEntries(Object.entries(o).filter(([key])=>!['recipientName','recipientPhone','shippingAddress','note','updatedAt'].includes(key)));
  const id=await create(), original=await detail(id);
  const stock=scalar(`SELECT Stock FROM Products WHERE Id=${pid}`);
  const profile=expect(await call(a.token,'GET','/users/me'),200);
  const cart=expect(await call(a.token,'GET','/cart'),200);
  const receipt=sql(`SELECT RequestHash FROM CheckoutReceipts WHERE OrderId=${id}`);
  const received=[[],[],[]];
  for(const [index,u] of [a,admin,b].entries()) {
    const hub=new HubConnectionBuilder().withUrl(`${base}/hubs/orders`,{accessTokenFactory:()=>u.token,transport:HttpTransportType.WebSockets}).configureLogging(LogLevel.None).build();
    hub.on('OrderUpdated',event=>received[index].push(event.orderId)); connections.push(hub); await hub.start();
  }
  expect(await update(null,id),401); expect(await update(b,id),404); expect(await update(a,id,form,true),403);
  expect(await update(admin,2147483647,form,true),404);
  const edits=await Promise.all([update(a,id),update(a,id)]); edits.forEach(r=>expect(r,200));
  const saved=await detail(id);
  assert.equal(saved.recipientName,'Recipient Updated'); assert.equal(saved.recipientPhone,'+84 901234567');
  assert.equal(saved.shippingAddress,'New address'); assert.equal(saved.note,'Doorbell'); assert.ok(saved.updatedAt);
  assert.deepEqual(preserved(saved),preserved(original));
  expect(await update(a,id),200);
  assert.equal((await detail(id)).updatedAt,saved.updatedAt);
  assert.equal(scalar(`SELECT Stock FROM Products WHERE Id=${pid}`),stock);
  assert.deepEqual(expect(await call(a.token,'GET','/users/me'),200),profile);
  assert.deepEqual(expect(await call(a.token,'GET','/cart'),200),cart);
  assert.equal(sql(`SELECT RequestHash FROM CheckoutReceipts WHERE OrderId=${id}`),receipt);
  for(let i=0;i<30&&(!received[0].length||!received[1].length);i++) await new Promise(r=>setTimeout(r,50));
  assert.deepEqual(received,[[id],[id],[]]);
  console.log('PASS: own Pending, trimmed fields, concurrent no-op replay, owner/admin-only OrderUpdated; timestamps, totals, snapshots, stock, profile, cart and receipt preserved');
  for(const invalid of [{recipientName:''},{recipientName:'   '},{recipientName:'x'.repeat(101)}, {recipientPhone:'abc'}, {recipientPhone:''},{recipientPhone:'1'.repeat(21)}, {shippingAddress:' '},{shippingAddress:'x'.repeat(501)},{note:'x'.repeat(501)}]) expect(await update(a,id,{...form,...invalid}),400);
  for(const key of ['totalAmount','paymentStatus','status','userId','items','orderDetails','createdAt','paymentMethod']) expect(await update(a,id,{...form,[key]:'forbidden'}),400);
  assert.deepEqual(await detail(id),saved);
  expect(await update(admin,id,{...form,note:null},true),200); assert.equal((await detail(id)).note,null);
  expect(await update(a,id,{recipientName:'N'.repeat(100),recipientPhone:'1'.repeat(20),shippingAddress:'A'.repeat(500),note:'N'.repeat(500)}),200);
  console.log('PASS: required/phone/length/unknown-field validation, max-length boundary, optional note, Admin Pending update');
  expect(await status(id,'Confirmed'),200);
  expect(await update(a,id,{...form,shippingAddress:'Confirmed customer'}),200);
  const confirmedBefore=await detail(id);
  expect(await update(admin,id,{...form,shippingAddress:'Confirmed admin'},true),200);
  assert.deepEqual(preserved(await detail(id)),preserved(confirmedBefore));
  // Simulates an already-paid Confirmed bank order without changing production payment rules.
  sql(`UPDATE Orders SET PaymentMethod='BankTransfer',PaymentStatus='Paid',PaidAt=SYSUTCDATETIME() WHERE Id=${id} AND UserId=${a.id}`);
  const paid=await detail(id);
  expect(await update(a,id,{...form,shippingAddress:'Paid order address'}),200);
  assert.deepEqual(preserved(await detail(id)),preserved(paid));
  const stale=await detail(id);
  expect(await status(id,'Shipping'),200);
  for(const who of [a,admin]) expect(await update(who,id,{...form,shippingAddress:'STALE'},who===admin),409);
  assert.equal((await detail(id)).shippingAddress,stale.shippingAddress);
  expect(await status(id,'Completed'),200);
  for(const who of [a,admin]) expect(await update(who,id,form,who===admin),409);
  const cancelled=await create(); expect(await call(a.token,'PUT',`/orders/${cancelled}/cancel`),200);
  for(const who of [a,admin]) expect(await update(who,cancelled,form,who===admin),409);
  console.log('PASS: Customer/Admin Confirmed edits, paid snapshot intact, stale Shipping save rejected; Shipping/Completed/Cancelled locked');
  for(let i=0;i<4;i++) {
    const racing=await create(); expect(await status(racing,'Confirmed'),200);
    const [edit,ship]=await Promise.all([update(a,racing,{...form,shippingAddress:'Race address'}),status(racing,'Shipping')]);
    expect(ship,200); assert.ok([200,409].includes(edit.status));
    const final=await detail(racing); assert.equal(final.status,'Shipping');
    assert.equal(final.shippingAddress,edit.status===200?'Race address':'Original');
    expect(await update(a,racing,{...form,shippingAddress:'After Shipping'}),409);
  }
  console.log('PASS: concurrent edit/Shipping serializes safely; later writes cannot edit shipped order');
} finally {
  await Promise.all(connections.map(c=>c.stop()));
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
