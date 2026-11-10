const { test, after } = require('node:test');
const assert = require('node:assert');

process.env.API_KEY = 'test-key';
process.env.JWT_SECRET = 'test-secret';
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../index');
const { prisma } = require('../db');

const KEY = 'test-key';
const TOKEN = jwt.sign({ key: KEY, ip: '1.2.3.4', time: Date.now() }, process.env.JWT_SECRET, { audience: 'bot' });
const auth = (r) => r.set('x-api-key', KEY).set('authorization', `Bearer ${TOKEN}`);
const serial = 'TEST-' + Math.random().toString(36).slice(2, 10);

after(async () => {
  const d = await prisma.device.findUnique({ where: { serial } });
  if (d) {
    await prisma.deviceLog.deleteMany({ where: { deviceId: d.id } });
    await prisma.gpsPing.deleteMany({ where: { deviceId: d.id } });
    await prisma.device.delete({ where: { id: d.id } });
  }
  await prisma.$disconnect();
});

test('GET /api/config returns the three keys', async () => {
  const res = await auth(request(app).get('/api/config'));
  assert.strictEqual(res.status, 200);
  assert.ok('main_url_lao' in res.body);
  assert.ok('main_url_thai' in res.body);
  assert.ok('upload_file_url' in res.body);
});

test('GET /api/config without api key is 401', async () => {
  const res = await request(app).get('/api/config');
  assert.strictEqual(res.status, 401);
});

test('POST /api/log with a new serial creates Device + DeviceLog', async () => {
  const res = await auth(request(app).post('/api/log'))
    .send({ serial, level: 'system', message: 'bot started', payload: { bank: 'KBANK' } });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ok, true);
  const dev = await prisma.device.findUnique({ where: { serial }, include: { logs: true } });
  assert.ok(dev, 'device created');
  assert.strictEqual(dev.logs.length, 1);
  assert.strictEqual(dev.logs[0].message, 'bot started');
});

test('POST /api/report upserts device bot fields', async () => {
  const res = await auth(request(app).post('/api/report'))
    .send({ serial, botVersion: '5.0.0', publicIp: '9.9.9.9' });
  assert.strictEqual(res.status, 200);
  const dev = await prisma.device.findUnique({ where: { serial } });
  assert.strictEqual(dev.botVersion, '5.0.0');
  assert.strictEqual(dev.publicIp, '9.9.9.9');
});
