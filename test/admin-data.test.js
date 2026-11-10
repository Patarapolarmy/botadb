const { test, before, after } = require('node:test');
const assert = require('node:assert');

process.env.API_KEY = 'test-key';
process.env.JWT_SECRET = 'test-secret';
const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../index');
const { prisma } = require('../db');

const username = 'dataadmin-' + Math.random().toString(36).slice(2, 8);
const password = 'pw';
const serial = 'ADMIN-DEV-' + Math.random().toString(36).slice(2, 8);
let agent;
let origThai;

before(async () => {
  await prisma.appUser.create({ data: { username, passwordHash: bcrypt.hashSync(password, 10) } });
  await prisma.device.create({ data: { serial, name: 'd1', botVersion: '5.0.0' } });
  const s = await prisma.setting.findUnique({ where: { key: 'main_url_thai' } });
  origThai = s ? s.value : null;
  agent = request.agent(app);
  await agent.post('/admin/login').send({ username, password });
});
after(async () => {
  if (origThai !== null) {
    await prisma.setting.update({ where: { key: 'main_url_thai' }, data: { value: origThai } });
  }
  const d = await prisma.device.findUnique({ where: { serial } });
  if (d) {
    await prisma.deviceLog.deleteMany({ where: { deviceId: d.id } });
    await prisma.device.delete({ where: { id: d.id } });
  }
  await prisma.appUser.deleteMany({ where: { username } });
  await prisma.$disconnect();
});

test('unauthenticated admin api is 401', async () => {
  const res = await request(app).get('/admin/api/config');
  assert.strictEqual(res.status, 401);
});

test('PUT then GET config round-trips a changed value', async () => {
  const put = await agent.put('/admin/api/config').send({ main_url_thai: 'https://changed.example' });
  assert.strictEqual(put.status, 200);
  const get = await agent.get('/admin/api/config');
  assert.strictEqual(get.status, 200);
  assert.strictEqual(get.body.main_url_thai, 'https://changed.example');
});

test('GET devices returns online boolean + latestGps field', async () => {
  const res = await agent.get('/admin/api/devices');
  assert.strictEqual(res.status, 200);
  const dev = res.body.find((d) => d.serial === serial);
  assert.ok(dev, 'device present');
  assert.strictEqual(typeof dev.online, 'boolean');
  assert.ok('latestGps' in dev);
});

test('GET device logs returns an array', async () => {
  const dev = await prisma.device.findUnique({ where: { serial } });
  const res = await agent.get(`/admin/api/devices/${dev.id}/logs`);
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body));
});
