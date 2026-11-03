// Explicit local development/test database only; all test rows are tagged and cleaned.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const base = process.env.CONTACT_API_URL || 'http://localhost:5127';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local API required');
const args = ['-S', process.env.CONTACT_SQL_SERVER || '.' + String.fromCharCode(92) + 'SQLEXPRESS', '-d', process.env.CONTACT_SQL_DATABASE || 'GemstoneShop', '-E', '-C', '-b', '-h', '-1', '-W'];
const sql = query => execFileSync('sqlcmd', [...args, '-Q', 'SET NOCOUNT ON; ' + query], { encoding: 'utf8' }).trim();
const scalar = query => Number(sql(query));
const tag = 'contact-' + randomUUID().replaceAll('-', '');
const email = tag + '@example.invalid';
const users = [];
let schemaReady = false;
const payload = { fullName: 'Contact sample customer', email, phone: '0901234567', subject: 'Product consultation', message: 'Please advise on gemstone certification.' };
async function call(token, method, path, body) {
  const r = await fetch(base + '/api' + path, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const raw = await r.text(); let data; try { data = JSON.parse(raw); } catch { data = raw; }
  return { status: r.status, data };
}
function expect(r, status) { assert.equal(r.status, status, JSON.stringify(r.data)); return r.data; }
async function user(admin = false) {
  const accountEmail = tag + '-' + users.length + '@example.invalid', password = randomUUID() + 'Aa9!';
  expect(await call(null, 'POST', '/auth/register', { fullName: tag, email: accountEmail, password }), 200);
  const id = scalar("SELECT Id FROM Users WHERE Email='" + accountEmail + "'"); users.push(id);
  if (admin) sql("UPDATE Users SET RoleId=(SELECT Id FROM Roles WHERE Name='Admin') WHERE Id=" + id);
  return { id, ...expect(await call(null, 'POST', '/auth/login', { email: accountEmail, password }), 200) };
}
const pass = text => console.log('PASS: ' + text);
try {
  const script = fileURLToPath(new URL('../backend/GemstoneShop/GemstoneShop/Database/ContactMessages.sql', import.meta.url));
  execFileSync('sqlcmd', [...args, '-i', script], { encoding: 'utf8' });
  schemaReady = true;
  const admin = await user(true), customer = await user(), other = await user();
  const guest = expect(await call(null, 'POST', '/contact', { ...payload, userId: other.id, status: 'Resolved', adminNote: 'injected' }), 201);
  assert.deepEqual(Object.keys(guest), ['message']);
  const guestId = scalar("SELECT Id FROM ContactMessages WHERE Email='" + email + "'");
  let detail = expect(await call(admin.token, 'GET', '/admin/contacts/' + guestId), 200);
  assert.equal(detail.userId, null); assert.equal(detail.status, 'New'); assert.equal(detail.adminNote, null);
  expect(await call(customer.token, 'POST', '/contact', { ...payload, userId: other.id }), 201);
  const id = scalar("SELECT MAX(Id) FROM ContactMessages WHERE Email='" + email + "'");
  detail = expect(await call(admin.token, 'GET', '/admin/contacts/' + id), 200);
  assert.equal(detail.userId, customer.id);
  pass('Guest submission, JWT ownership, spoofed UserId/status/note ignored, public DTO minimal');

  for (const patch of [{ email: 'invalid' }, { fullName: '   ' }, { subject: '' }, { message: '' }, { message: ' '.repeat(10) }, { message: null }, { message: 'short' }, { message: 'x'.repeat(4001) }, { phone: '-------' }, { phone: 'abc12345678' }, { fullName: 'x'.repeat(101) }, { email: 'a'.repeat(250) + '@example.invalid' }, { subject: 'x'.repeat(101) }])
    expect(await call(null, 'POST', '/contact', { ...payload, ...patch }), 400);
  assert.equal(scalar("SELECT COUNT(*) FROM ContactMessages WHERE Email='" + email + "'"), 2);
  expect(await call('not-a-jwt', 'POST', '/contact', payload), 401);
  pass('Invalid data rejected without storing rows; invalid supplied JWT rejected');

  for (const token of [null, customer.token, other.token]) {
    const code = token ? 403 : 401;
    expect(await call(token, 'GET', '/admin/contacts'), code);
    expect(await call(token, 'GET', '/admin/contacts/' + id), code);
    expect(await call(token, 'PUT', '/admin/contacts/' + id, { status: 'Resolved', adminNote: 'unauthorized' }), code);
  }
  for (const path of ['/contact', '/contact/' + id]) {
    const r = await call(null, 'GET', path);
    assert.ok([404, 405].includes(r.status));
    assert.ok(!JSON.stringify(r.data).includes(payload.message));
  }
  const list = expect(await call(admin.token, 'GET', '/admin/contacts?status=New'), 200);
  assert.ok(list.items.some(x => x.id === id)); assert.ok(list.items.every(x => x.status === 'New' && !('adminNote' in x)));
  expect(await call(admin.token, 'GET', '/admin/contacts?status=Fake'), 400);
  expect(await call(admin.token, 'GET', '/admin/contacts?page=0'), 400);
  expect(await call(admin.token, 'GET', '/admin/contacts/2147483647'), 404);
  pass('Only Admin can enumerate/read/update; server filtering and pagination validated');

  expect(await call(admin.token, 'PUT', '/admin/contacts/' + id, { status: 'InProgress', adminNote: 'Internal test note', fullName: 'overwritten', userId: other.id }), 204);
  detail = expect(await call(admin.token, 'GET', '/admin/contacts/' + id), 200);
  assert.equal(detail.status, 'InProgress'); assert.equal(detail.adminNote, 'Internal test note');
  assert.equal(detail.fullName, payload.fullName); assert.equal(detail.userId, customer.id); assert.ok(detail.updatedAt);
  expect(await call(admin.token, 'PUT', '/admin/contacts/' + id, { status: 'Fake' }), 400);
  expect(await call(admin.token, 'PUT', '/admin/contacts/' + id, { status: 'Resolved', adminNote: 'x'.repeat(2001) }), 400);
  expect(await call(admin.token, 'PUT', '/admin/contacts/' + id, { status: 'Resolved', adminNote: 'Done' }), 204);
  assert.equal(expect(await call(admin.token, 'GET', '/admin/contacts/' + id), 200).status, 'Resolved');
  execFileSync('sqlcmd', [...args, '-i', script], { encoding: 'utf8' });
  assert.equal(scalar("SELECT COUNT(*) FROM ContactMessages WHERE Email='" + email + "'"), 2);
  assert.equal(scalar("SELECT delete_referential_action FROM sys.foreign_keys WHERE name='FK_ContactMessages_Users'"), 0);
  pass('Admin workflow changes only status/note; SQL rerun preserves rows and FK does not cascade');

  sql('UPDATE Users SET IsActive=0 WHERE Id=' + customer.id);
  expect(await call(customer.token, 'POST', '/contact', payload), 401);
  sql('UPDATE Users SET IsActive=0 WHERE Id=' + admin.id);
  expect(await call(admin.token, 'GET', '/admin/contacts'), 401);
  pass('Inactive existing sessions rejected for both submission and management');
} finally {
  if (schemaReady) sql("DELETE FROM ContactMessages WHERE Email='" + email + "';");
  if (users.length) sql("DELETE FROM Users WHERE Id IN (" + users.join(',') + ") AND FullName='" + tag + "'");
  console.log('Temporary contact fixtures cleaned.');
}
