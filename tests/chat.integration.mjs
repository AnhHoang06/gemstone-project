// Local development/test DB only. Never target a shared production database.
// Creates its own users/products/conversations (tagged) and removes them in `finally`.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { HubConnectionBuilder, HttpTransportType, LogLevel } = require('@microsoft/signalr');
const env = name => process.env[`CHAT_${name}`] || process.env[`PERSON3_${name}`];
const base = env('API_URL') || 'http://localhost:5113';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Only local test APIs are allowed');
const sqlArgs = ['-S', env('SQL_SERVER') || '.\\SQLEXPRESS', '-d', env('SQL_DATABASE') || 'GemstoneShop', '-E', '-C', '-b', '-h', '-1', '-W'];
const sql = query => execFileSync('sqlcmd', [...sqlArgs, '-Q', `SET NOCOUNT ON; ${query}`], { encoding: 'utf8' }).trim();
const scalar = query => Number(sql(query));
const script = fileURLToPath(new URL('../backend/GemstoneShop/GemstoneShop/Database/Chat.sql', import.meta.url));
const tag = `chat-${randomUUID().replaceAll('-', '')}`;
const users = [], products = [], connections = [];
let categoryId;

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
  return { id, email, ...expect(await call(null, 'POST', '/auth/login', { email, password }), 200) };
}
const pass = message => console.log(`PASS: ${message}`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label) { for (let i = 0; i < 50; i++) { if (predicate()) return; await sleep(100); } assert.fail(`Realtime timeout: ${label}`); }
async function hub(u) {
  const events = [];
  const connection = new HubConnectionBuilder().withUrl(`${base}/hubs/chat`, { accessTokenFactory: () => u.token, transport: HttpTransportType.WebSockets })
    .configureLogging(LogLevel.None).build();
  for (const name of ['ChatMessage', 'ChatRead', 'ChatConversation', 'Typing']) connection.on(name, data => events.push({ name, ...data }));
  connections.push(connection); await connection.start();
  return { connection, events };
}
const send = (u, body, extra = {}) => call(u.token, 'POST', '/chat/me/messages', { clientMessageId: randomUUID(), body, ...extra });
const reply = (admin, id, body, extra = {}) => call(admin.token, 'POST', `/admin/chat/conversations/${id}/messages`, { clientMessageId: randomUUID(), body, ...extra });
const conversationOf = u => scalar(`SELECT ISNULL((SELECT Id FROM ChatConversations WHERE CustomerId=${u.id}),0)`);

try {
  const admin = await user(true), admin2 = await user(true);
  const a = await user(), b = await user(), c = await user();
  categoryId = expect(await call(admin.token, 'POST', '/categories', { name: tag, isActive: true }), 201).id;
  const productId = expect(await call(admin.token, 'POST', '/products', { categoryId, name: `${tag}-p`, price: 2500000, stock: 3, isActive: true }), 201).id;
  products.push(productId);
  const hiddenProduct = expect(await call(admin.token, 'POST', '/products', { categoryId, name: `${tag}-hidden`, price: 1, stock: 1, isActive: false }), 201).id;
  products.push(hiddenProduct);

  // ── Access rules ───────────────────────────────────────────────────────────
  expect(await call(null, 'GET', '/chat/me'), 401);
  expect(await call(null, 'GET', '/chat/unread'), 401);
  assert.equal(expect(await call(admin.token, 'GET', '/chat/me'), 403).code, 'staff_use_inbox');
  expect(await send(admin, 'xin chào'), 403);
  expect(await call(a.token, 'GET', '/admin/chat/conversations'), 403);
  const empty = expect(await call(a.token, 'GET', '/chat/me'), 200);
  assert.equal(empty.conversation, null); assert.deepEqual(empty.messages, []);
  assert.equal(conversationOf(a), 0);
  assert.equal(expect(await call(a.token, 'GET', '/chat/unread'), 200).count, 0);
  pass('Login required; admins get 403 on the customer endpoints; viewing does not create a conversation');

  // ── Validation ─────────────────────────────────────────────────────────────
  for (const body of ['', '   \n  ', 'x'.repeat(2001)]) assert.equal(expect(await send(a, body), 400).code, 'invalid_body');
  expect(await call(a.token, 'POST', '/chat/me/messages', { body: 'thiếu mã' }), 400);
  assert.equal(expect(await send(a, 'sản phẩm ẩn', { productId: hiddenProduct }), 400).code, 'invalid_product');
  assert.equal(expect(await send(a, 'không tồn tại', { productId: 2147483647 }), 400).code, 'invalid_product');
  assert.equal(conversationOf(a), 0);
  pass('Body must be 1–2000 characters after trim; clientMessageId required; attached product must be publicly visible');

  // ── Realtime isolation between customers ───────────────────────────────────
  const hubA = await hub(a), hubB = await hub(b), hubAdmin = await hub(admin), hubAdmin2 = await hub(admin2);
  const html = '<img src=x onerror=alert(1)> Cho mình hỏi viên này còn không?  ';
  const m1 = expect(await send(a, html, { productId }), 201);
  assert.equal(m1.body, html.trim()); assert.equal(m1.senderRole, 'Customer');
  assert.deepEqual([m1.product.id, m1.product.name, m1.product.price, m1.product.isAvailable], [productId, `${tag}-p`, 2500000, true]);
  assert.ok(m1.createdAt.endsWith('Z'));
  const convA = m1.conversationId;
  const mb = expect(await send(b, 'Tôi muốn đặt lịch xem đá'), 201);
  const convB = mb.conversationId;
  assert.notEqual(convA, convB);
  await until(() => hubAdmin.events.some(e => e.name === 'ChatMessage' && e.message.id === m1.id) &&
    hubAdmin.events.some(e => e.name === 'ChatMessage' && e.message.id === mb.id), 'staff receives both customers');
  await until(() => hubA.events.some(e => e.name === 'ChatMessage' && e.message.id === m1.id), 'customer A echo');
  await until(() => hubB.events.some(e => e.name === 'ChatMessage' && e.message.id === mb.id), 'customer B echo');
  await sleep(300);
  assert.ok(!hubA.events.some(e => e.conversationId === convB), 'A must not receive B events');
  assert.ok(!hubB.events.some(e => e.conversationId === convA), 'B must not receive A events');
  const meA = expect(await call(a.token, 'GET', '/chat/me'), 200), meB = expect(await call(b.token, 'GET', '/chat/me'), 200);
  assert.deepEqual(meA.messages.map(m => m.id), [m1.id]); assert.deepEqual(meB.messages.map(m => m.id), [mb.id]);
  assert.equal(meA.conversation.id, convA); assert.equal(meA.conversation.status, 'Open');
  assert.equal(JSON.stringify(meA).includes('senderUserId'), false);
  pass('Customer A never receives customer B messages (HTTP or SignalR); staff receives both; body stored as raw text');

  // ── Staff inbox ────────────────────────────────────────────────────────────
  const inbox = expect(await call(admin.token, 'GET', `/admin/chat/conversations?q=${tag}`), 200);
  assert.deepEqual(inbox.map(x => x.id).sort(), [convA, convB].sort());
  assert.deepEqual(inbox.map(x => x.id), [convB, convA]); // newest activity first
  const itemA = inbox.find(x => x.id === convA);
  assert.equal(itemA.unreadCount, 1); assert.equal(itemA.customer.email, a.email); assert.equal(itemA.lastMessage.id, m1.id);
  assert.equal(itemA.orderCount, 0); assert.equal(itemA.upcomingAppointmentCount, 0);
  expect(await call(admin.token, 'GET', '/admin/chat/conversations?status=Weird'), 400);
  expect(await call(admin.token, 'GET', '/admin/chat/conversations/2147483647/messages'), 404);
  const thread = expect(await call(admin.token, 'GET', `/admin/chat/conversations/${convA}/messages`), 200);
  assert.deepEqual(thread.messages.map(m => m.id), [m1.id]); assert.equal(thread.conversation.customer.id, a.id);
  const staffUnreadBefore = expect(await call(admin.token, 'GET', '/chat/unread'), 200).count;
  assert.ok(staffUnreadBefore >= 2);
  const r1 = expect(await reply(admin, convA, 'Dạ, viên này còn hàng ạ.'), 201);
  assert.equal(r1.senderRole, 'Staff');
  assert.equal(expect(await call(admin.token, 'GET', '/chat/unread'), 200).count, staffUnreadBefore - 1); // replying marks read
  await until(() => hubA.events.some(e => e.name === 'ChatMessage' && e.message.id === r1.id), 'customer receives staff reply');
  await until(() => hubA.events.some(e => e.name === 'ChatRead' && e.side === 'Staff' && e.lastReadId === r1.id), 'customer sees staff read');
  await sleep(300);
  assert.ok(!hubB.events.some(e => e.name === 'ChatMessage' && e.message.id === r1.id));
  assert.equal(expect(await call(a.token, 'GET', '/chat/unread'), 200).count, 1);
  const read = expect(await call(a.token, 'POST', '/chat/me/read', { lastMessageId: r1.id + 1000 }), 200);
  assert.deepEqual([read.conversationId, read.side, read.lastReadId], [convA, 'Customer', r1.id]); // clamped to the last message
  await until(() => hubAdmin.events.some(e => e.name === 'ChatRead' && e.conversationId === convA && e.side === 'Customer' && e.lastReadId === r1.id), 'staff sees customer read');
  assert.equal(expect(await call(a.token, 'POST', '/chat/me/read', { lastMessageId: 1 }), 200).lastReadId, r1.id); // never moves back
  assert.equal(expect(await call(a.token, 'GET', '/chat/unread'), 200).count, 0);
  expect(await call(admin.token, 'POST', `/admin/chat/conversations/${convB}/read`, { lastMessageId: mb.id }), 200);
  expect(await call(admin.token, 'POST', '/admin/chat/conversations/2147483647/read', { lastMessageId: 1 }), 404);
  expect(await reply(admin, 2147483647, 'không có'), 404);
  pass('Staff inbox lists both conversations with unread counts/last message; replies reach only the owner; read pointers clamp and never go back');

  // ── Duplicate ClientMessageId ─────────────────────────────────────────────
  const clientMessageId = randomUUID();
  const dupes = await Promise.all(Array.from({ length: 5 }, () => call(a.token, 'POST', '/chat/me/messages', { clientMessageId, body: 'Gửi lại khi mạng chập chờn' })));
  dupes.forEach(r => assert.ok([200, 201].includes(r.status), JSON.stringify(r.data)));
  assert.equal(dupes.filter(r => r.status === 201).length, 1);
  assert.equal(new Set(dupes.map(r => r.data.id)).size, 1);
  assert.equal(scalar(`SELECT COUNT(*) FROM ChatMessages WHERE ConversationId=${convA} AND ClientMessageId='${clientMessageId}'`), 1);
  assert.equal(expect(await call(a.token, 'POST', '/chat/me/messages', { clientMessageId, body: 'nội dung khác' }), 409).code, 'request_mismatch');
  pass('Retrying with the same clientMessageId (even concurrently) stores one message; reuse with a different body → 409');

  // ── Closed → reopened by customer ──────────────────────────────────────────
  expect(await call(admin.token, 'PUT', `/admin/chat/conversations/${convA}/status`, { status: 'Archived' }), 400);
  expect(await call(admin.token, 'PUT', '/admin/chat/conversations/2147483647/status', { status: 'Closed' }), 404);
  expect(await call(a.token, 'PUT', `/admin/chat/conversations/${convA}/status`, { status: 'Closed' }), 403);
  assert.equal(expect(await call(admin.token, 'PUT', `/admin/chat/conversations/${convA}/status`, { status: 'Closed' }), 200).status, 'Closed');
  await until(() => hubA.events.some(e => e.name === 'ChatConversation' && e.status === 'Closed'), 'closed event');
  assert.equal(expect(await call(a.token, 'GET', '/chat/me'), 200).conversation.status, 'Closed');
  assert.ok(expect(await call(admin.token, 'GET', `/admin/chat/conversations?status=Closed&q=${tag}`), 200).every(x => x.status === 'Closed'));
  expect(await send(a, 'Mình hỏi thêm chút nữa'), 201);
  assert.equal(expect(await call(a.token, 'GET', '/chat/me'), 200).conversation.status, 'Open');
  await until(() => hubAdmin.events.some(e => e.name === 'ChatConversation' && e.conversationId === convA && e.status === 'Open'), 'reopen event');
  pass('Admin can close a conversation; a new customer message reopens it (events to both sides)');

  // ── Typing relay ──────────────────────────────────────────────────────────
  await hubA.connection.invoke('Typing', convA);
  await until(() => hubAdmin.events.some(e => e.name === 'Typing' && e.conversationId === convA && e.side === 'Customer'), 'staff sees typing');
  await hubAdmin.connection.invoke('Typing', convA);
  await until(() => hubA.events.some(e => e.name === 'Typing' && e.side === 'Staff'), 'customer sees staff typing');
  await sleep(1700);
  const typingBefore = hubAdmin.events.filter(e => e.name === 'Typing').length;
  await hubA.connection.invoke('Typing', convB); // not A's conversation
  await sleep(500);
  assert.equal(hubAdmin.events.filter(e => e.name === 'Typing').length, typingBefore);
  assert.ok(!hubB.events.some(e => e.name === 'Typing'));
  pass('Typing is relayed only to the other side of a conversation the caller belongs to');

  // ── Paging ────────────────────────────────────────────────────────────────
  const page1 = expect(await call(a.token, 'GET', '/chat/me?take=2'), 200);
  assert.equal(page1.messages.length, 2); assert.equal(page1.hasMore, true);
  const page2 = expect(await call(a.token, 'GET', `/chat/me?take=100&before=${page1.messages[0].id}`), 200);
  assert.equal(page2.hasMore, false);
  const all = [...page2.messages, ...page1.messages].map(m => m.id);
  assert.deepEqual(all, [...all].sort((x, y) => x - y));
  assert.equal(all.length, scalar(`SELECT COUNT(*) FROM ChatMessages WHERE ConversationId=${convA}`));
  expect(await call(a.token, 'GET', '/chat/me?take=0'), 400);
  expect(await call(a.token, 'GET', '/chat/me?take=101'), 400);
  pass('Message history pages backwards with before/take, ascending within a page');

  // ── Rate limit 8 / 30 s ───────────────────────────────────────────────────
  const burst = [];
  for (let i = 0; i < 8; i++) burst.push(expect(await send(c, `Tin ${i + 1}`), 201));
  const limited = expect(await send(c, 'Tin 9'), 429);
  assert.equal(limited.code, 'rate_limited'); assert.match(limited.message, /quá nhanh/); assert.ok(limited.retryAfterSeconds >= 1);
  expect(await call(c.token, 'POST', '/chat/me/messages', { clientMessageId: burst[0].clientMessageId, body: 'Tin 1' }), 200); // retries are not limited
  assert.equal(scalar(`SELECT COUNT(*) FROM ChatMessages WHERE SenderUserId=${c.id}`), 8);
  pass('More than 8 messages in 30 seconds → 429 rate_limited with a Vietnamese message; idempotent retries still succeed');

  // ── Locked accounts stop receiving ───────────────────────────────────────
  sql(`UPDATE Users SET IsActive=0 WHERE Id IN (${b.id},${admin2.id})`);
  const toB = expect(await reply(admin, convB, 'Tin gửi tới tài khoản đã khóa'), 201);
  const fromA = expect(await send(a, 'Tin sau khi khóa admin2'), 201);
  await until(() => hubAdmin.events.some(e => e.name === 'ChatMessage' && e.message.id === fromA.id), 'active admin still receives');
  await sleep(700);
  assert.ok(!hubB.events.some(e => e.name === 'ChatMessage' && e.message.id === toB.id), 'locked customer must not receive');
  assert.ok(!hubAdmin2.events.some(e => e.name === 'ChatMessage' && e.message.id === fromA.id), 'locked admin must not receive');
  expect(await call(b.token, 'GET', '/chat/me'), 401);
  const blocked = new HubConnectionBuilder().withUrl(`${base}/hubs/chat`, { accessTokenFactory: () => b.token, transport: HttpTransportType.LongPolling }).configureLogging(LogLevel.None).build();
  await assert.rejects(blocked.start());
  pass('Locked customer/admin accounts stop receiving on open connections and cannot reconnect or call the API');

  // ── Schema ────────────────────────────────────────────────────────────────
  const count = scalar(`SELECT COUNT(*) FROM ChatMessages WHERE ConversationId IN (${convA},${convB})`);
  execFileSync('sqlcmd', [...sqlArgs, '-i', script], { encoding: 'utf8' });
  execFileSync('sqlcmd', [...sqlArgs, '-i', script], { encoding: 'utf8' });
  assert.equal(scalar(`SELECT COUNT(*) FROM ChatMessages WHERE ConversationId IN (${convA},${convB})`), count);
  const err = q => scalar(`BEGIN TRY ${q}; SELECT 0; END TRY BEGIN CATCH SELECT ERROR_NUMBER(); END CATCH`);
  assert.equal(err(`INSERT INTO ChatConversations(CustomerId) VALUES(${a.id})`), 2627);
  assert.equal(err(`INSERT INTO ChatMessages(ConversationId,SenderUserId,SenderRole,Body,ClientMessageId) VALUES(${convA},${a.id},'Customer',N'x','${clientMessageId}')`), 2627);
  assert.equal(err(`INSERT INTO ChatMessages(ConversationId,SenderUserId,SenderRole,Body,ClientMessageId) VALUES(${convA},${a.id},'Bot',N'x',NEWID())`), 547);
  assert.equal(err(`INSERT INTO ChatMessages(ConversationId,SenderUserId,SenderRole,Body,ClientMessageId) VALUES(${convA},${a.id},'Customer',N'   ',NEWID())`), 547);
  assert.equal(err(`UPDATE ChatConversations SET Status='Pending' WHERE Id=${convA}`), 547);
  pass('Chat.sql reruns keep data; DB enforces one conversation per customer, unique clientMessageId, role/body/status checks');
} finally {
  for (const connection of connections) await connection.stop().catch(() => {});
  const ids = users.join(',') || '0';
  sql(`DELETE FROM ChatMessages WHERE SenderUserId IN (${ids}) OR ConversationId IN (SELECT Id FROM ChatConversations WHERE CustomerId IN (${ids}));
       DELETE FROM ChatConversations WHERE CustomerId IN (${ids});`);
  if (products.length) sql(`DELETE FROM ProductImages WHERE ProductId IN (${products.join(',')}); DELETE FROM Products WHERE Id IN (${products.join(',')}) AND Name LIKE N'${tag}%'`);
  if (categoryId) sql(`DELETE FROM Categories WHERE Id=${categoryId} AND Name=N'${tag}'`);
  if (users.length) sql(`DELETE FROM Users WHERE Id IN (${ids}) AND FullName=N'${tag}'`);
  console.log('Temporary chat fixtures cleaned up.');
}
