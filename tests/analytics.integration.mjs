// Local development database only. Historical fixtures are scoped to generated IDs and removed in finally.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const base = process.env.PERSON3_API_URL || 'http://localhost:5113';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local API required');
const tag = 'analytics-' + randomUUID().replaceAll('-', '');
const fixtureLabel = 'Test ' + tag.slice(-6);
const users = [], categories = [], products = [];
const sql = query => execFileSync('sqlcmd', ['-S', process.env.PERSON3_SQL_SERVER || '.\\SQLEXPRESS', '-d', process.env.PERSON3_SQL_DATABASE || 'GemstoneShop', '-E', '-C', '-b', '-h', '-1', '-W', '-Q', 'SET NOCOUNT ON; ' + query], { encoding: 'utf8' }).trim();
async function call(token, method, path, body) {
  const r = await fetch(base + '/api' + path, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const raw = await r.text(); let data; try { data = JSON.parse(raw); } catch { data = raw; }
  return { status: r.status, data };
}
function expect(r, status = 200) { assert.equal(r.status, status, JSON.stringify(r.data)); return r.data; }
async function user(role) {
  const email = tag + '-' + users.length + '@example.invalid', password = randomUUID() + '!aA9';
  expect(await call(null, 'POST', '/auth/register', { fullName: tag, email, password }));
  const id = Number(sql("SELECT Id FROM Users WHERE Email='" + email + "'")); users.push(id);
  if (role === 'Admin') sql("UPDATE Users SET RoleId=(SELECT Id FROM Roles WHERE Name='Admin') WHERE Id=" + id);
  return { id, ...expect(await call(null, 'POST', '/auth/login', { email, password })) };
}
const fixed = 'range=custom&start=2001-01-01&end=2001-01-10';
try {
  const admin = await user('Admin'), customer = await user('Customer');
  const get = async query => expect(await call(admin.token, 'GET', '/dashboard/analytics?' + query));
  for (const endpoint of ['/dashboard/analytics', '/dashboard/analytics/options']) {
    expect(await call(null, 'GET', endpoint), 401);
    expect(await call(customer.token, 'GET', endpoint), 403);
  }
  const baseline = await get(fixed);
  async function category(name, parentId = null) {
    const c = expect(await call(admin.token, 'POST', '/categories', { name: fixtureLabel + ' · ' + name, parentId, isActive: true }), 201);
    categories.push(c.id); return c.id;
  }
  const root = await category('Ruby'), child = await category('Ruby cuts', root), leaf = await category('Ruby stars', child), other = await category('Sapphire');
  async function product(name, categoryId) {
    const p = expect(await call(admin.token, 'POST', '/products', { name: fixtureLabel + ' · ' + name, categoryId, price: 999, stock: 100, isActive: true }), 201);
    products.push(p.id); return p.id;
  }
  const a = await product('Ruby Star', leaf), b = await product('Ruby Oval', child), c = await product('Sapphire Blue', other);
  function order(date, lines, status = 'Completed', payment = 'Paid') {
    const amount = lines.reduce((sum, [, qty, price]) => sum + qty * price, 0);
    const id = Number(sql("INSERT INTO Orders(UserId,StatusId,RecipientName,RecipientPhone,ShippingAddress,TotalAmount,CreatedAt,PaymentMethod,PaymentStatus) OUTPUT INSERTED.Id VALUES(" +
      customer.id + ",(SELECT Id FROM OrderStatuses WHERE Name='" + status + "'),'" + tag + "','0900000000','Test only'," + amount + ",'" + date + "','COD'," + (payment ? "'" + payment + "'" : 'NULL') + ")"));
    for (const [pid, qty, price] of lines) sql("INSERT INTO OrderDetails(OrderId,ProductId,ProductName,Quantity,UnitPrice) VALUES(" + [id, pid, "'Historical snapshot'", qty, price].join(',') + ")");
  }
  order('2001-01-01T23:59:59', [[a, 2, 1000000], [b, 1, 2000000], [c, 3, 500000]]);
  order('2001-01-02', [[a, 1, 1000000]]);
  order('2001-01-10T23:59:59', [[b, 2, 2000000]]);
  for (const [status, payment] of [['Completed', 'Unpaid'], ['Completed', null], ['Pending', 'Paid'], ['Cancelled', 'Paid'], ['Shipping', 'Paid']])
    order('2001-01-03', [[a, 7, 1000000]], status, payment);
  order('2000-12-31T23:59:59', [[a, 9, 1000000]]);
  order('2001-01-11', [[a, 9, 1000000]]);
  sql('UPDATE Products SET IsActive=0 WHERE Id=' + a + '; UPDATE Categories SET IsActive=0 WHERE Id=' + root);
  const all = await get(fixed);
  assert.equal(all.summary.revenue - baseline.summary.revenue, 10500000);
  assert.equal(all.summary.unitsSold - baseline.summary.unitsSold, 9);
  assert.equal(all.summary.completedOrders - baseline.summary.completedOrders, 3);
  assert.equal(all.summary.averageOrderValue, all.summary.revenue / all.summary.completedOrders);
  assert.equal(all.breakdown.find(s => s.id === root).revenue, 9000000);
  assert.equal(all.breakdown.find(s => s.id === other).revenue, 1500000);
  for (const [key, trendKey] of [['revenue', 'revenue'], ['unitsSold', 'unitsSold'], ['completedOrders', 'orders']])
    assert.equal(all.trend.reduce((sum, row) => sum + row[trendKey], 0), all.summary[key]);
  console.log('PASS: all categories, paid + completed only, distinct orders, snapshot prices, units, average, UTC date boundaries');
  const parent = await get(fixed + '&categoryId=' + root);
  assert.deepEqual(parent.summary, { revenue: 9000000, completedOrders: 3, unitsSold: 6, averageOrderValue: 3000000 });
  const one = await get(fixed + '&categoryId=' + leaf);
  assert.deepEqual(one.summary, { revenue: 3000000, completedOrders: 2, unitsSold: 3, averageOrderValue: 1500000 });
  const filtered = await get(fixed + '&categoryId=' + root + '&productId=' + a);
  assert.deepEqual(filtered.summary, one.summary);
  assert.equal(filtered.breakdown.length, 2); assert.deepEqual(filtered.breakdown, parent.breakdown);
  assert.equal((await get(fixed + '&productId=' + a)).filters.categoryId, leaf);
  assert.equal((await get('range=custom&start=2001-01-02&end=2001-01-02&categoryId=' + root)).summary.revenue, 1000000);
  const empty = await get('range=custom&start=2001-01-04&end=2001-01-05&categoryId=' + root);
  assert.deepEqual(empty.summary, { revenue: 0, completedOrders: 0, unitsSold: 0, averageOrderValue: 0 });
  assert.equal(empty.trend.length, 2); assert.equal(empty.breakdown.length, 0);
  console.log('PASS: 3-level descendants, inactive history, category/product drill-down, retained donut context, empty/zero buckets');
  const opts = expect(await call(admin.token, 'GET', '/dashboard/analytics/options'));
  assert.equal(opts.products.find(p => p.id === a).grandparentId, root);
  assert.equal(opts.products.find(p => p.id === a).isActive, false);
  for (const q of ['range=bad', 'range=custom&start=bad&end=2001-01-10', 'range=custom&start=2001-01-10&end=2001-01-01', 'range=custom', 'range=custom&start=2001-01-01&end=2003-01-01', fixed + '&categoryId=' + other + '&productId=' + a, 'range=7d&start=2001-01-01'])
    expect(await call(admin.token, 'GET', '/dashboard/analytics?' + q), 400);
  for (const q of [fixed + '&categoryId=2147483647', fixed + '&productId=2147483647'])
    expect(await call(admin.token, 'GET', '/dashboard/analytics?' + q), 404);
  for (const [range, grouping] of [['7d', 'daily'], ['30d', 'daily'], ['3m', 'weekly'], ['6m', 'monthly'], ['1y', 'monthly']]) {
    const r = await get('range=' + range + '&categoryId=' + root);
    assert.equal(r.filters.grouping, grouping);
    assert.equal(r.trend[0].startDate, r.filters.start);
    assert.equal(r.trend.at(-1).endDate, r.filters.end);
    for (let i = 1; i < r.trend.length; i++) assert.equal(Date.parse(r.trend[i].startDate) - Date.parse(r.trend[i - 1].endDate), 86400000);
  }
  expect(await call(admin.token, 'GET', '/dashboard/summary'));
  console.log('PASS: Admin authorization, options, validation, daily/weekly/monthly continuous buckets and existing summary');

  if (process.env.ANALYTICS_SCREENSHOTS === '1') {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
      const page = await browser.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(session => { localStorage.setItem('token', session.token); localStorage.setItem('role', 'Admin'); localStorage.setItem('fullName', 'Analytics verification'); }, admin);
      const frontend = process.env.ANALYTICS_FRONTEND_URL || 'http://localhost:2223';
      if (!['localhost', '127.0.0.1'].includes(new URL(frontend).hostname)) throw new Error('Local frontend required');
      await page.setViewportSize({ width: 1366, height: 1000 });
      await page.goto(frontend + '/admin/dashboard', { waitUntil: 'domcontentloaded' });
      await page.getByLabel('Thời gian', { exact: true }).waitFor({ timeout: 15000 }).catch(async error => {
        console.error('Browser diagnostics:', page.url(), errors, (await page.locator('body').innerText()).slice(0, 1200));
        throw error;
      });
      await page.getByLabel('Thời gian', { exact: true }).selectOption('custom');
      await page.getByLabel('Từ ngày (UTC)').fill('2001-01-01');
      await page.getByLabel('Đến ngày (UTC)').fill('2001-01-10');
      await page.getByRole('heading', { name: 'Cơ cấu bán hàng' }).waitFor();
      await page.screenshot({ path: 'docs/admin-analytics/all-1366.png', fullPage: true });
      await page.locator('.analytics-legend button').filter({ hasText: fixtureLabel + ' · Ruby' }).click();
      await page.waitForFunction(id => document.querySelector('select') && [...document.querySelectorAll('select')].some(s => s.value === String(id)), root);
      await page.getByRole('button', { name: new RegExp(fixtureLabel + ' · Ruby Star') }).click();
      await page.getByRole('button', { pressed: true }).waitFor();
      assert.equal(await page.getByLabel('Sản phẩm', { exact: true }).inputValue(), String(a));
      assert.equal(await page.locator('.dashboard-metric dd').first().innerText(), (3000000).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' }));
      assert.equal(await page.locator('.analytics-legend button').count(), 2);
      await page.screenshot({ path: 'docs/admin-analytics/product-1366.png', fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: 'docs/admin-analytics/product-390.png', fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
      assert.deepEqual(errors, []);
      console.log('PASS: browser drill-down, exact KPI, comparison highlight, desktop/mobile screenshots, no overflow/JS errors');
    } finally { await browser.close(); }
  }
} finally {
  if (users.length) {
    const ids = users.join(',');
    sql('DELETE FROM OrderDetails WHERE OrderId IN (SELECT Id FROM Orders WHERE UserId IN (' + ids + ')); DELETE FROM Orders WHERE UserId IN (' + ids + '); DELETE FROM Users WHERE Id IN (' + ids + ');');
  }
  if (products.length) sql('DELETE FROM Products WHERE Id IN (' + products.join(',') + ')');
  for (const id of categories.reverse()) sql('DELETE FROM Categories WHERE Id=' + id);
  console.log('Analytics fixtures cleaned up.');
}
