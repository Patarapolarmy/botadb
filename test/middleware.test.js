const { test } = require('node:test');
const assert = require('node:assert');

process.env.API_KEY = 'test-key';
process.env.JWT_SECRET = 'test-secret';
const jwt = require('jsonwebtoken');
const { checkApiKey, checkJwt, requireAdmin } = require('../middleware');

function mockRes() {
  return {
    code: null, body: null, cleared: false,
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
    clearCookie() { this.cleared = true; return this; },
  };
}

test('checkApiKey rejects wrong key with 401', () => {
  const res = mockRes();
  let nextCalled = false;
  checkApiKey({ header: () => 'nope', headers: {}, socket: {} }, res, () => { nextCalled = true; });
  assert.strictEqual(res.code, 401);
  assert.strictEqual(nextCalled, false);
});

test('checkApiKey passes correct key', () => {
  const res = mockRes();
  let nextCalled = false;
  checkApiKey({ header: () => 'test-key', headers: {}, socket: {} }, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.code, null);
});

test('requireAdmin rejects missing cookie with 401', () => {
  const res = mockRes();
  let nextCalled = false;
  requireAdmin({ cookies: {} }, res, () => { nextCalled = true; });
  assert.strictEqual(res.code, 401);
  assert.strictEqual(nextCalled, false);
});

test('requireAdmin passes a valid admin cookie', () => {
  const res = mockRes();
  let nextCalled = false;
  const token = jwt.sign({ uid: 1, role: 'admin' }, process.env.JWT_SECRET);
  const req = { cookies: { token } };
  requireAdmin(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.admin.uid, 1);
});

test('checkJwt rejects missing Bearer with 401', () => {
  const res = mockRes();
  let nextCalled = false;
  checkJwt({ header: () => undefined }, res, () => { nextCalled = true; });
  assert.strictEqual(res.code, 401);
  assert.strictEqual(nextCalled, false);
});
