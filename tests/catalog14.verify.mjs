// Verify an existing Catalog14_v2 without changing it. Creates only a temporary admin; cleans it in finally.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const base = process.env.PERSON3_API_URL || 'http://localhost:5117';
const frontend = process.env.ANALYTICS_FRONTEND_URL || 'http://localhost:2222';
for (const url of [base, frontend])
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Local development URLs only');
const sql = (query, wide = false) => execFileSync('sqlcmd', ['-S', process.env.PERSON3_SQL_SERVER || '.\\SQLEXPRESS',
  '-d', process.env.PERSON3_SQL_DATABASE || 'GemstoneShop', '-E', '-C', '-b', ...(wide ? ['-y', '0'] : ['-h', '-1']), '-w', '65535',
  '-f', '65001', '-Q', 'SET NOCOUNT ON; ' + query], { encoding: 'utf8' }).trim();
const json = query => JSON.parse(sql(query + ' FOR JSON PATH', true).replace(/\r?\n/g, ''));
const seed = "LEFT(o.Note,13)=N'Catalog14_v2:'";
const stats = json("SELECT COUNT(*) Orders,MIN(CONVERT(char(10),CreatedAt,23)) StartDate,MAX(CONVERT(char(10),CreatedAt,23)) EndDate,MIN(TotalAmount) MinTotal,MAX(TotalAmount) MaxTotal,AVG(TotalAmount) AverageTotal FROM Orders o WHERE " + seed)[0];
assert.equal(stats.Orders, 564, 'Run the dedicated seed first');
assert.ok(stats.MinTotal > 0 && stats.MaxTotal < 200000000 && stats.MaxTotal / stats.AverageTotal < 10);
const roots = json("SELECT DISTINCT c.Id,c.Name FROM Categories c JOIN Products p ON p.CategoryId=c.Id WHERE LEFT(p.Description,13)=N'Catalog14_v2:' ORDER BY c.Id");
assert.equal(roots.length, 5);
const products = json("SELECT p.Id,p.Name,COALESCE(c.ParentId,c.Id) RootId FROM Products p JOIN Categories c ON c.Id=p.CategoryId WHERE LEFT(p.Description,13)=N'Catalog14_v2:' ORDER BY p.Id");
assert.equal(products.length, 14);
assert.equal(Number(sql("SELECT COUNT(*) FROM OrderDetails d JOIN Orders o ON o.Id=d.OrderId WHERE " + seed + " AND (d.Quantity NOT BETWEEN 1 AND 3 OR d.UnitPrice<=0 OR d.UnitPrice>20000000)")), 0);
const days = json("SELECT CONVERT(date,CreatedAt) Day,COUNT(*) Orders FROM Orders o WHERE " + seed + " GROUP BY CONVERT(date,CreatedAt)");
assert.ok(days.length >= 250, 'Orders must be spread across the year');
assert.ok(Math.max(...days.map(d => d.Orders)) < 15, 'Unexpected daily order spike');

assert.equal(Number(sql("SELECT COUNT(DISTINCT DATEDIFF(month,DATEADD(month,-12,CONVERT(date,'2026-11-03')),DATEADD(day,-2,CreatedAt))) FROM Orders o WHERE " + seed)),12);
assert.equal(Number(sql("SELECT COUNT(*) FROM Products WHERE IsActive=1")),14);
assert.equal(Number(sql("SELECT COUNT(*) FROM OrderDetails d JOIN Orders o ON o.Id=d.OrderId JOIN Products p ON p.Id=d.ProductId WHERE " + seed + " AND (p.IsActive<>1 OR p.Description NOT LIKE 'Catalog14[_]v2:%')")),0);
for (const product of products) {
  const imageRows=json('SELECT ImageUrl FROM ProductImages WHERE ProductId='+product.Id);
  assert.equal(imageRows.length,1);
  const image=await fetch(base+imageRows[0].ImageUrl);
  assert.equal(image.status,200);
  assert.ok(image.headers.get('content-type').startsWith('image/'));
  const detail=await fetch(base+'/api/products/'+product.Id);
  assert.equal(detail.status,200);
  assert.equal((await detail.json()).id,product.Id);
}
const publicProducts=await (await fetch(base+'/api/products')).json();
assert.deepEqual(publicProducts.map(p=>p.id).sort((a,b)=>a-b),products.map(p=>p.Id).sort((a,b)=>a-b));
assert.ok(publicProducts.every(p=>!/(test|demo|sample|mẫu)/iu.test(p.name)));
console.log('PASS: exact 14 public products, real detail endpoints and all 14 image URLs');

async function call(token, method, path, body) {
  const res = await fetch(base + '/api' + path, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  assert.equal(res.status, 200, await res.clone().text());
  return res.json();
}
let adminId;
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
  const chosen = [products[0], products[1], products[6]];
  for (const product of chosen) {
    const data = await verify(product.RootId, product.Id);
    const soldProducts = Number(sql(`SELECT COUNT(DISTINCT d.ProductId) FROM OrderDetails d
      JOIN Orders o ON o.Id=d.OrderId JOIN OrderStatuses st ON st.Id=o.StatusId
      JOIN Products p ON p.Id=d.ProductId JOIN Categories c ON c.Id=p.CategoryId
      WHERE st.Name='Completed' AND o.PaymentStatus='Paid'
        AND o.CreatedAt>='${stats.StartDate}' AND o.CreatedAt<DATEADD(day,1,CONVERT(date,'${stats.EndDate}'))
        AND (c.Id=${product.RootId} OR c.ParentId=${product.RootId})`));
    assert.equal(data.breakdown.length, soldProducts);
    assert.ok(data.summary.revenue < data.breakdown.reduce((sum, b) => sum + b.revenue, 0));
  }
  console.log('PASS: seed size, dates, price/quantity bounds, no daily spikes; all/categories/products match SQL');

  console.log('Seed remains available for manual dashboard testing:', JSON.stringify(stats));
} finally {
  if (adminId) sql('DELETE FROM WishlistItems WHERE UserId=' + adminId + '; DELETE FROM CartItems WHERE CartId IN (SELECT Id FROM Carts WHERE UserId=' + adminId + '); DELETE FROM Carts WHERE UserId=' + adminId + '; DELETE FROM Users WHERE Id=' + adminId);
  console.log('Temporary verification admin cleaned; persistent seed unchanged.');
}
