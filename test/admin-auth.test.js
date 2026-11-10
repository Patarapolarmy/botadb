const { test, before, after } = require('node:test');
const assert = require('node:assert');

process.env.API_KEY = 'test-key';
process.env.JWT_SECRET = 'test-secret';
const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../index');
const { prisma } = require('../db');

const username = 'testadmin-' + Math.random().toString(36).slice(2, 8);
const password = 's3cret-pass';

before(async () => {
  await prisma.appUser.create({
    data: { username, passwordHash: bcrypt.hashSync(password, 10), role: 'admin' },
  });
});
after(async () => {
  await prisma.appUser.deleteMany({ where: { username } });
  await prisma.$disconnect();
});

test('login with correct creds returns 200 + token cookie', async () => {
  const res = await request(app).post('/admin/login').send({ username, password });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ok, true);
  const cookie = res.headers['set-cookie'];
  assert.ok(cookie && cookie.join(';').includes('token='), 'sets token cookie');
  assert.ok(cookie.join(';').toLowerCase().includes('httponly'), 'cookie is httpOnly');
});

test('login with wrong password returns 401 and no cookie', async () => {
  const res = await request(app).post('/admin/login').send({ username, password: 'nope' });
  assert.strictEqual(res.status, 401);
  assert.ok(!res.headers['set-cookie'], 'no cookie set');
});

test('login with unknown user returns 401', async () => {
  const res = await request(app).post('/admin/login').send({ username: 'ghost', password });
  assert.strictEqual(res.status, 401);
});
