const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { prisma } = require('../db');
const { requireAdmin } = require('../middleware');

const COOKIE = 'token';
const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// POST /admin/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
  const user = await prisma.appUser.findUnique({ where: { username } });
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ uid: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d', audience: 'admin' });
  res.cookie(COOKIE, token, cookieOpts);
  res.json({ ok: true });
});

// POST /admin/logout
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

const CONFIG_KEYS = ['main_url_lao', 'main_url_thai', 'upload_file_url'];
const ONLINE_MS = 10 * 60 * 1000;

// GET /admin/api/config
router.get('/api/config', requireAdmin, async (req, res) => {
  const rows = await prisma.setting.findMany();
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

// PUT /admin/api/config  { key: value, ... }
router.put('/api/config', requireAdmin, async (req, res) => {
  const body = req.body || {};
  const entries = Object.entries(body).filter(([, v]) => typeof v === 'string');
  for (const [key, value] of entries) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  res.json({ ok: true });
});

// GET /admin/api/devices  — list with online + latest gps
router.get('/api/devices', requireAdmin, async (req, res) => {
  const devices = await prisma.device.findMany({ orderBy: { lastSeen: 'desc' } });
  const now = Date.now();
  const out = await Promise.all(devices.map(async (d) => {
    const latestGps = await prisma.gpsPing.findFirst({
      where: { deviceId: d.id }, orderBy: { createdAt: 'desc' },
    });
    return { ...d, online: now - new Date(d.lastSeen).getTime() < ONLINE_MS, latestGps };
  }));
  res.json(out);
});

// GET /admin/api/devices/:id/logs?level=
router.get('/api/devices/:id/logs', requireAdmin, async (req, res) => {
  const deviceId = Number(req.params.id);
  const where = { deviceId };
  if (req.query.level) where.level = String(req.query.level);
  const logs = await prisma.deviceLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
  res.json(logs);
});

// GET /admin/api/devices/:id/gps  — latest + last 24h
router.get('/api/devices/:id/gps', requireAdmin, async (req, res) => {
  const deviceId = Number(req.params.id);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const history = await prisma.gpsPing.findMany({
    where: { deviceId, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' },
  });
  res.json({ latest: history[0] || null, history });
});

module.exports = router;
module.exports.requireAdmin = requireAdmin;
