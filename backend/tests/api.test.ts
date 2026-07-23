import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'http';
import { app } from '../src/server.js';

let server: ReturnType<typeof createServer>;
const BASE = 'http://localhost:3001';

before(() => {
  server = createServer(app);
  server.listen(3001);
});

after(() => {
  server.close();
});

async function fetchApi(path: string, opts?: RequestInit) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts
  });
  const data = await res.json();
  return { status: res.status, data };
}

describe('API Tests', () => {
  it('GET /api/stats returns stats', async () => {
    const { status, data } = await fetchApi('/api/stats');
    assert.equal(status, 200);
    assert.ok(data.totalMissing >= 0);
    assert.ok(data.totalFound >= 0);
    assert.ok(data.totalActive >= 0);
    assert.ok(data.totalVerified >= 0);
  });

  it('GET /api/missing returns missing reports', async () => {
    const { status, data } = await fetchApi('/api/missing');
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    if (data.length > 0) {
      assert.ok(data[0].name);
      assert.ok(data[0].age);
      assert.ok(data[0].governorate);
    }
  });

  it('GET /api/missing/:id returns single report', async () => {
    const list = await fetchApi('/api/missing');
    if (list.data.length > 0) {
      const id = list.data[0].id;
      const { status, data } = await fetchApi('/api/missing/' + id);
      assert.equal(status, 200);
      assert.equal(data.id, id);
    }
  });

  it('GET /api/sightings returns sightings', async () => {
    const { status, data } = await fetchApi('/api/sightings');
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
  });

  it('GET /api/search?q= searches', async () => {
    const { status, data } = await fetchApi('/api/search?q=test');
    assert.equal(status, 200);
    assert.ok(data.missing);
    assert.ok(data.sightings);
  });

  it('POST /api/auth/register validates input', async () => {
    const { status, data } = await fetchApi('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com', password: '123' })
    });
    assert.equal(status, 400);
    assert.ok(data.errors || data.error);
  });

  it('POST /api/auth/register creates user', async () => {
    const email = 'test-' + Date.now() + '@aman-test.com';
    const { status, data } = await fetchApi('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'مستخدم تجريبي', email, phone: '01234567890', password: 'test123456' })
    });
    assert.equal(status, 201);
    assert.ok(data.accessToken);
    assert.ok(data.refreshToken);
    assert.ok(data.user);
  });

  it('POST /api/contact validates input', async () => {
    const { status, data } = await fetchApi('/api/contact', {
      method: 'POST',
      body: JSON.stringify({ name: '', email: 'bad', message: '' })
    });
    assert.equal(status, 400);
  });

  it('GET /api/missing filters by governorate', async () => {
    const { data } = await fetchApi('/api/missing?governorate=القاهرة');
    assert.ok(Array.isArray(data));
    data.forEach((r: any) => {
      assert.equal(r.governorate, 'القاهرة');
    });
  });

  it('GET /api/missing filters by gender', async () => {
    const { data } = await fetchApi('/api/missing?gender=male');
    assert.ok(Array.isArray(data));
    data.forEach((r: any) => {
      assert.equal(r.gender, 'male');
    });
  });

  it('GET /api/missing filters by status', async () => {
    const { data } = await fetchApi('/api/missing?status=found');
    assert.ok(Array.isArray(data));
    data.forEach((r: any) => {
      assert.equal(r.status, 'found');
    });
  });

  it('GET /api/missing filters by age range', async () => {
    const { data } = await fetchApi('/api/missing?age=18-30');
    assert.ok(Array.isArray(data));
    data.forEach((r: any) => {
      assert.ok(r.age >= 18 && r.age <= 30);
    });
  });

  it('POST /api/auth/login authenticates', async () => {
    const email = 'test-' + Date.now() + '@aman-test.com';
    await fetchApi('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'اختبار', email, phone: '01234567890', password: 'test123456' })
    });
    const { status, data } = await fetchApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'test123456' })
    });
    assert.equal(status, 200);
    assert.ok(data.accessToken);
  });

  it('POST /api/auth/login rejects wrong password', async () => {
    const { status } = await fetchApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'nonexistent@test.com', password: 'wrong' })
    });
    assert.equal(status, 401);
  });

  it('POST /api/auth/register rejects non-Arabic name', async () => {
    const { status, data } = await fetchApi('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'John Doe', email: 'john@test.com', phone: '01234567890', password: 'test123456' })
    });
    assert.equal(status, 400);
    assert.ok(data.error.includes('العربية'));
  });

  it('POST /api/auth/register rejects Arabic password', async () => {
    const { status, data } = await fetchApi('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'محمد علي', email: 'arabic@test.com', phone: '01234567890', password: 'مرور123' })
    });
    assert.equal(status, 400);
    assert.ok(data.error.includes('إنجليزية'));
  });

  it('GET /api/admin/* rejects unauthenticated', async () => {
    const { status } = await fetchApi('/api/admin/stats');
    assert.equal(status, 401);
  });

  it('GET /api/admin/* rejects non-admin users', async () => {
    const email = 'regular-' + Date.now() + '@test.com';
    const reg = await fetchApi('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'مستخدم عادي', email, phone: '01234567890', password: 'test123456' })
    });
    const token = reg.data.accessToken;
    const { status, data } = await fetchApi('/api/admin/stats', {
      headers: { Authorization: 'Bearer ' + token }
    });
    assert.equal(status, 403);
  });
});