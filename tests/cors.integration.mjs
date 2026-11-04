// Read-only CORS checks against a running API. No data is created.
// CORS_API_URL (default http://localhost:5113), CORS_ALLOWED (comma list, default http://localhost:2222),
// CORS_DENIED (comma list, default https://not-allowed.example.test).
import assert from 'node:assert/strict';

const api = (process.env.CORS_API_URL ?? 'http://localhost:5113').replace(/\/+$/, '');
const allowed = (process.env.CORS_ALLOWED ?? 'http://localhost:2222').split(',').map((s) => s.trim()).filter(Boolean);
const denied = (process.env.CORS_DENIED ?? 'https://not-allowed.example.test').split(',').map((s) => s.trim()).filter(Boolean);

const preflight = (path, origin, method = 'GET', headers = 'authorization,content-type') =>
  fetch(api + path, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': headers } });

let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`PASS | ${name}`); } catch (e) { failures++; console.log(`FAIL | ${name} | ${e.message}`); }
}

for (const origin of allowed) {
  await check(`${origin} preflight GET /api/products with Authorization`, async () => {
    const r = await preflight('/api/products', origin);
    assert.equal(r.headers.get('access-control-allow-origin'), origin);
    assert.equal(r.headers.get('access-control-allow-credentials'), 'true');
    assert.match(r.headers.get('access-control-allow-headers') ?? '', /authorization/i);
  });
  await check(`${origin} preflight POST /api/orders (JSON body)`, async () => {
    const r = await preflight('/api/orders', origin, 'POST');
    assert.equal(r.headers.get('access-control-allow-origin'), origin);
    assert.match(r.headers.get('access-control-allow-methods') ?? '', /POST/);
  });
  for (const hub of ['/hubs/chat', '/hubs/orders']) {
    await check(`${origin} SignalR ${hub}/negotiate preflight + credentials`, async () => {
      const r = await preflight(`${hub}/negotiate?negotiateVersion=1`, origin, 'POST', 'authorization,x-requested-with,x-signalr-user-agent');
      assert.equal(r.headers.get('access-control-allow-origin'), origin);
      assert.equal(r.headers.get('access-control-allow-credentials'), 'true');
    });
  }
  await check(`${origin} actual GET /api/categories carries CORS headers`, async () => {
    const r = await fetch(api + '/api/categories', { headers: { Origin: origin } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('access-control-allow-origin'), origin);
    // ASP.NET Core adds Vary: Origin when the policy lists more than one origin.
    if (allowed.length > 1) assert.match(r.headers.get('vary') ?? '', /origin/i);
  });
}

for (const origin of denied) {
  await check(`${origin} is refused (no Access-Control-Allow-Origin)`, async () => {
    const p = await preflight('/api/products', origin);
    assert.equal(p.headers.get('access-control-allow-origin'), null);
    const h = await preflight('/hubs/chat/negotiate?negotiateVersion=1', origin, 'POST');
    assert.equal(h.headers.get('access-control-allow-origin'), null);
    const g = await fetch(api + '/api/categories', { headers: { Origin: origin } });
    assert.equal(g.headers.get('access-control-allow-origin'), null);
  });
}

await check('wildcard is never returned', async () => {
  const r = await preflight('/api/products', allowed[0]);
  assert.notEqual(r.headers.get('access-control-allow-origin'), '*');
});

console.log(failures ? `${failures} CORS check(s) failed` : 'All CORS checks passed');
process.exitCode = failures ? 1 : 0;
