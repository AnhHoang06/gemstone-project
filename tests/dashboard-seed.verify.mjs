// Verify an existing DashboardSeed_v1 without changing it. Creates only a temporary admin; cleans it in finally.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';

const base = process.env.PERSON3_API_URL || 'http://localhost:5117';
const frontend = process.env.ANALYTICS_FRONTEND_URL || 'http://localhost:2222';
for (const url of [base, frontend])
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Local development URLs only');
const sql = (query, wide = false) => execFileSync('sqlcmd', ['-S', process.env.PERSON3_SQL_SERVER || '.\\SQLEXPRESS',
  '-d', process.env.PERSON3_SQL_DATABASE || 'GemstoneShop', '-E', '-C', '-b', ...(wide ? ['-y', '0'] : ['-h', '-1']), '-w', '65535',
  '-f', '65001', '-Q', 'SET NOCOUNT ON; ' + query], { encoding: 'utf8' }).trim();
const json = query => JSON.parse(sql(query + ' FOR JSON PATH', true).replace(/\r?\n/g, ''));
const seed = "LEFT(o.Note,17)=N'DashboardSeed_v1:'";
const stats = json("SELECT COUNT(*) Orders,MIN(CONVERT(char(10),CreatedAt,23)) StartDate,MAX(CONVERT(char(10),CreatedAt,23)) EndDate,MIN(TotalAmount) MinTotal,MAX(TotalAmount) MaxTotal,AVG(TotalAmount) AverageTotal FROM Orders o WHERE " + seed)[0];
assert.equal(stats.Orders, 1062, 'Run the dedicated seed first');
assert.ok(stats.MinTotal > 0 && stats.MaxTotal < 200000000 && stats.MaxTotal / stats.AverageTotal < 10);
const roots = json("SELECT Id,Name FROM Categories WHERE LEFT(Description,17)=N'DashboardSeed_v1:' AND ParentId IS NULL ORDER BY SortOrder");
assert.equal(roots.length, 4);
const products = json("SELECT p.Id,p.Name,c.ParentId RootId FROM Products p JOIN Categories c ON c.Id=p.CategoryId WHERE LEFT(p.Description,17)=N'DashboardSeed_v1:' ORDER BY p.Id");
assert.equal(products.length, 64);
assert.equal(Number(sql("SELECT COUNT(*) FROM OrderDetails d JOIN Orders o ON o.Id=d.OrderId WHERE " + seed + " AND (d.Quantity NOT BETWEEN 1 AND 4 OR d.UnitPrice<=0 OR d.UnitPrice>20000000)")), 0);
const days = json("SELECT CONVERT(date,CreatedAt) Day,COUNT(*) Orders FROM Orders o WHERE " + seed + " GROUP BY CONVERT(date,CreatedAt)");
assert.ok(days.length >= 280, 'Orders must be spread across the year');
assert.ok(Math.max(...days.map(d => d.Orders)) < 15, 'Unexpected daily order spike');

async function call(token, method, path, body) {
  const res = await fetch(base + '/api' + path, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  assert.equal(res.status, 200, await res.clone().text());
  return res.json();
}
let adminId, browser;
try {
  const email = 'dashboard-verify-' + randomUUID() + '@example.invalid', password = randomUUID() + '!aA9';
  await call(null, 'POST', '/auth/register', { fullName: 'Kiểm tra dashboard', email, password });
  adminId = Number(sql("SELECT Id FROM Users WHERE Email='" + email + "'"));
  sql("UPDATE Users SET RoleId=(SELECT Id FROM Roles WHERE Name='Admin') WHERE Id=" + adminId);
  const session = await call(null, 'POST', '/auth/login', { email, password });
  async function verify(categoryId, productId) {
    const params = new URLSearchParams({ range: 'custom', start: stats.StartDate, end: stats.EndDate });
    if (categoryId) params.set('categoryId', categoryId);
    if (productId) params.set('productId', productId);
    const data = await call(session.token, 'GET', '/dashboard/analytics?' + params);
    // Independently aggregate all matching DB rows, including any real preexisting sales.
    const condition = (categoryId ? ' AND (c.Id=' + categoryId + ' OR c.ParentId=' + categoryId + ' OR parent.ParentId=' + categoryId + ')' : '') +
      (productId ? ' AND p.Id=' + productId : '');
    const expected = json("SELECT COALESCE(SUM(d.UnitPrice*d.Quantity),0) Revenue,COALESCE(SUM(d.Quantity),0) Units,COUNT(DISTINCT o.Id) Orders FROM OrderDetails d JOIN Orders o ON o.Id=d.OrderId JOIN OrderStatuses st ON st.Id=o.StatusId JOIN Products p ON p.Id=d.ProductId JOIN Categories c ON c.Id=p.CategoryId LEFT JOIN Categories parent ON parent.Id=c.ParentId WHERE st.Name='Completed' AND o.PaymentStatus='Paid' AND o.CreatedAt>='" + stats.StartDate + "' AND o.CreatedAt<DATEADD(day,1,CONVERT(date,'" + stats.EndDate + "'))" + condition)[0];
    assert.equal(data.summary.revenue, expected.Revenue);
    assert.equal(data.summary.unitsSold, expected.Units);
    assert.equal(data.summary.completedOrders, expected.Orders);
    assert.ok(Math.abs(data.summary.averageOrderValue - (expected.Orders ? expected.Revenue / expected.Orders : 0)) < 0.01);
    assert.equal(data.trend.reduce((sum, b) => sum + b.revenue, 0), expected.Revenue);
    assert.equal(data.trend.reduce((sum, b) => sum + b.orders, 0), expected.Orders);
    assert.equal(data.trend.reduce((sum, b) => sum + b.unitsSold, 0), expected.Units);
    if (!productId) assert.equal(data.breakdown.reduce((sum, b) => sum + b.revenue, 0), expected.Revenue);
    console.log('PASS API:', categoryId || 'All', productId || 'All', JSON.stringify(data.summary));
    return data;
  }
  const all = await verify();
  for (const root of roots.slice(0, 2)) await verify(root.Id);
  const chosen = [products[0], products[1], products[16]];
  for (const product of chosen) {
    const data = await verify(product.RootId, product.Id);
    assert.equal(data.breakdown.length, 16);
    assert.ok(data.summary.revenue < data.breakdown.reduce((sum, b) => sum + b.revenue, 0));
  }
  console.log('PASS: seed size, dates, price/quantity bounds, no daily spikes; all/categories/products match SQL');

  if (process.env.ANALYTICS_SCREENSHOTS === '1') {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(s => { localStorage.setItem('token', s.token); localStorage.setItem('role', 'Admin'); localStorage.setItem('fullName', 'Kiểm tra dashboard'); }, session);
    await page.goto(frontend + '/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Thời gian', { exact: true }).selectOption('custom');
    await page.getByLabel('Từ ngày (UTC)').fill(stats.StartDate);
    await page.getByLabel('Đến ngày (UTC)').fill(stats.EndDate);
    const money = value => value.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
    async function checkDisplayed(expected) {
      await page.getByRole('heading', { name: 'Cơ cấu bán hàng' }).waitFor();
      await page.waitForFunction(text => document.querySelector('.dashboard-metric dd')?.textContent === text, money(expected.summary.revenue));
      assert.equal(await page.locator('canvas').count(), 2);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await checkDisplayed(all);
    mkdirSync('docs/admin-analytics/seed', { recursive: true });
    await page.screenshot({ path: 'docs/admin-analytics/seed/all-1366.png', fullPage: true });
    for (const [i, root] of roots.slice(0, 2).entries()) {
      await page.getByLabel('Danh mục', { exact: true }).selectOption(String(root.Id));
      await checkDisplayed(await verify(root.Id));
      await page.screenshot({ path: 'docs/admin-analytics/seed/category-' + (i + 1) + '-1366.png', fullPage: true });
    }
    for (const [i, product] of chosen.entries()) {
      await page.getByLabel('Danh mục', { exact: true }).selectOption(String(product.RootId));
      await page.getByLabel('Sản phẩm', { exact: true }).selectOption(String(product.Id));
      await checkDisplayed(await verify(product.RootId, product.Id));
      await page.getByRole('button', { pressed: true }).waitFor();
      assert.equal(await page.locator('.analytics-legend button').count(), 16);
      if (i === 0) await page.screenshot({ path: 'docs/admin-analytics/seed/product-1366.png', fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await checkDisplayed(await verify(chosen[2].RootId, chosen[2].Id));
    await page.screenshot({ path: 'docs/admin-analytics/seed/product-390.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS browser: All, 2 categories, 3 products, meaningful comparison, desktop/mobile without overflow/JS errors');
  }
  console.log('Seed remains available for manual dashboard testing:', JSON.stringify(stats));
} finally {
  if (browser) await browser.close();
  if (adminId) sql('DELETE FROM WishlistItems WHERE UserId=' + adminId + '; DELETE FROM CartItems WHERE CartId IN (SELECT Id FROM Carts WHERE UserId=' + adminId + '); DELETE FROM Carts WHERE UserId=' + adminId + '; DELETE FROM Users WHERE Id=' + adminId);
  console.log('Temporary verification admin cleaned; persistent seed unchanged.');
}
