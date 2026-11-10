const { test, after } = require('node:test');
const assert = require('node:assert');

process.env.API_KEY = 'test-key';
process.env.JWT_SECRET = 'test-secret';
const request = require('supertest');
const app = require('../index');
const { prisma } = require('../db');

const KEY = 'test-key';
const serial = 'PHONE-' + Math.random().toString(36).slice(2, 10);

after(async () => {
  const d = await prisma.device.findUnique({ where: { serial } });
  if (d) {
    await prisma.gpsPing.deleteMany({ where: { deviceId: d.id } });
    await prisma.device.delete({ where: { id: d.id } });
  }
  await prisma.$disconnect();
});

test('POST /api/phone-report needs api key', async () => {
  const res = await request(app).post('/api/phone-report').send({ serial, lat: 1, lng: 2 });
  assert.strictEqual(res.status, 401);
});

test('POST /api/phone-report with new serial creates Device + one GpsPing', async () => {
  const res = await request(app).post('/api/phone-report').set('x-api-key', KEY)
    .send({ serial, model: 'SM-A155', brand: 'samsung', androidVersion: '14', battery: 87,
      wifiSsid: 'Shop', wifiIp: '192.168.1.5', lat: 13.75, lng: 100.5, accuracy: 12 });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ok, true);
  const dev = await prisma.device.findUnique({ where: { serial }, include: { gpsPings: true } });
  assert.ok(dev);
  assert.strictEqual(dev.model, 'SM-A155');
  assert.strictEqual(dev.battery, 87);
  assert.strictEqual(dev.gpsPings.length, 1);
});

test('second phone-report appends a second GpsPing to same device', async () => {
  await request(app).post('/api/phone-report').set('x-api-key', KEY)
    .send({ serial, lat: 13.76, lng: 100.51 });
  const dev = await prisma.device.findUnique({ where: { serial }, include: { gpsPings: true } });
  assert.strictEqual(dev.gpsPings.length, 2);
});
