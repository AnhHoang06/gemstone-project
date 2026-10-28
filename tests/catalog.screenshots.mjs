// Local-only visual QA with disposable API/SQL fixtures. No browser auth state is saved.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw Error('Pass before or after');
const sql = query => execFileSync('sqlcmd', ['-S', '.\\SQLEXPRESS', '-d', 'GemstoneShop', '-E', '-C', '-b', '-h', '-1', '-W', '-Q', `SET NOCOUNT ON; ${query}`], { encoding: 'utf8' }).trim();
const tag = `visual-${randomUUID().replaceAll('-', '')}`;
let userId, categoryId, browser;
const productIds = [], childIds = [];
async function api(path, body, token) {
  const r = await fetch(`http://localhost:5113/api${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw Error(`${path}: ${r.status} ${await r.text()}`);
  return r.json();
}
try {
  const email = `${tag}@example.invalid`, password = `${randomUUID()}!aA9`;
  await api('/auth/register', { fullName: tag, email, password });
  userId = Number(sql(`SELECT Id FROM Users WHERE Email='${email}'`));
  sql(`UPDATE Users SET RoleId=(SELECT Id FROM Roles WHERE Name='Admin') WHERE Id=${userId}`);
  const auth = await api('/auth/login', { email, password });
  categoryId = (await api('/categories', { name: 'Bộ sưu tập kiểm thử giao diện', isActive: true }, auth.token)).id;
  if (phase === 'after') {
    childIds.push((await api('/categories', { name: 'Nhẫn kiểm thử', parentId: categoryId, isActive: true }, auth.token)).id);
    childIds.push((await api('/categories', { name: 'Đính đá kiểm thử', parentId: childIds[0], isActive: true }, auth.token)).id);
  }
  for (const [index, name] of ['Sapphire xanh lam', 'Kim cương tròn', 'Ruby đỏ', 'Ngọc lục bảo', 'Thạch anh tím', 'Đá quý tự nhiên'].entries()) {
    productIds.push((await api('/products', { name: `${name} · kiểm thử`, categoryId, price: (index + 1) * 1500000, stock: 5, carat: 1.25, origin: 'Dữ liệu kiểm thử', isActive: true }, auth.token)).id);
  }
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:2222/login');
  await page.evaluate(data => { for (const key of ['token', 'role', 'fullName']) localStorage.setItem(key, data[key]); }, auth);
  const folder = `docs/catalog-redesign/${phase}`;
  mkdirSync(folder, { recursive: true });
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of [['home', '/'], ['shop', '/shop'], ['filtered', `/shop?category=${categoryId}&q=Sapphire`], ['detail', `/product/${productIds[0]}`], ['admin-categories', '/admin/categories']]) {
      await page.goto(`http://localhost:2222${path}`);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${folder}/${name}-${width}.png`, fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      console.log(`${phase} ${name} ${width}: horizontal overflow=${overflow}`);
      if (phase === 'after') {
        assert.equal(overflow, false, `${name} ${width} overflows`);
        if (name === 'home') {
          const trigger = width >= 992 ? page.getByRole('button', { name: 'Thế giới đá quý' }) : page.getByRole('button', { name: 'Mở menu điều hướng' });
          await trigger.click();
          await page.getByRole('link', { name: 'Đính đá kiểm thử', exact: true }).waitFor();
          await page.screenshot({ path: `${folder}/menu-${width}.png`, fullPage: true });
          await page.keyboard.press('Escape');
          if (width >= 992) assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
          else assert.equal(await page.getByRole('dialog').count(), 0);
        }
        if (name === 'shop' && width === 390) {
          await page.getByRole('button', { name: 'Danh mục & bộ lọc' }).click();
          await page.screenshot({ path: `${folder}/filters-${width}.png`, fullPage: true });
          await page.keyboard.press('Escape');
        }
      }

    }
  }
  if (phase === 'after') {
    await page.goto(`http://localhost:2222/shop?category=${encodeURIComponent('Bộ sưu tập kiểm thử giao diện')}`);
    await page.waitForURL(`**/shop?category=${categoryId}`);
    assert.deepEqual(errors, [], 'No uncaught browser errors');
  }
} finally {
  if (browser) await browser.close();
  if (productIds.length) sql(`DELETE FROM Products WHERE Id IN (${productIds.join(',')})`);
  for (const id of childIds.reverse()) sql(`DELETE FROM Categories WHERE Id=${id}`);
  if (categoryId) sql(`DELETE FROM Categories WHERE Id=${categoryId}`);
  if (userId) sql(`DELETE FROM Carts WHERE UserId=${userId}; DELETE FROM Users WHERE Id=${userId} AND FullName='${tag}'`);
}
