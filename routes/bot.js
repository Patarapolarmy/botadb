const router = require('express').Router();
const { prisma } = require('../db');
const { checkApiKey, checkJwt } = require('../middleware');

const CONFIG_KEYS = ['main_url_lao', 'main_url_thai', 'upload_file_url'];
const DEFAULTS = {
  main_url_lao: 'https://withdraw.r1auto4567.com',
  main_url_thai: 'https://withdraw.r1auto4567.com',
  upload_file_url: 'https://withdraw.r1auto4567.com/upload/upload_file',
};

// upsert a device by serial, fill only provided fields
async function upsertDevice(serial, fields) {
  return prisma.device.upsert({
    where: { serial },
    create: { serial, ...fields },
    update: fields,
  });
}

// GET /api/config — global config for bots
router.get('/config', checkApiKey, checkJwt, async (req, res) => {
  try {
    const rows = await prisma.setting.findMany();
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const out = {};
    for (const k of CONFIG_KEYS) out[k] = map[k] ?? DEFAULTS[k];
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: 'config failed' });
  }
});

// POST /api/report — bot (PC-side) device report
router.post('/report', checkApiKey, checkJwt, async (req, res) => {
  const { serial, name, botVersion, publicIp, localIp, pcLocation, pcIsp } = req.body || {};
  if (!serial) return res.status(400).json({ error: 'Missing serial' });
  const fields = {};
  for (const [k, v] of Object.entries({ name, botVersion, publicIp, localIp, pcLocation, pcIsp })) {
    if (v !== undefined) fields[k] = v;
  }
  try {
    await upsertDevice(serial, fields);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'report failed' });
  }
});

// POST /api/log — replaces Telegram messages
router.post('/log', checkApiKey, checkJwt, async (req, res) => {
  const { serial, level, message, payload } = req.body || {};
  if (!serial || !message) return res.status(400).json({ error: 'Missing serial or message' });
  try {
    const device = await upsertDevice(serial, {});
    await prisma.deviceLog.create({
      data: { deviceId: device.id, level: level || 'info', message, payload: payload ?? undefined },
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'log failed' });
  }
});

// POST /api/phone-report — app (phone-side) hourly report + one GpsPing
router.post('/phone-report', checkApiKey, async (req, res) => {
  const { serial, model, brand, androidVersion, battery, wifiSsid, wifiIp, lat, lng, accuracy } = req.body || {};
  if (!serial || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Missing serial/lat/lng' });
  }
  const fields = {};
  for (const [k, v] of Object.entries({ model, brand, androidVersion, battery, wifiSsid, wifiIp })) {
    if (v !== undefined) fields[k] = v;
  }
  try {
    let device;
    try {
      device = await upsertDevice(serial, fields);
    } catch (e) {
      device = await upsertDevice(serial, fields); // retry once on unique-constraint race
    }
    await prisma.gpsPing.create({ data: { deviceId: device.id, lat, lng, accuracy: accuracy ?? undefined } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'phone-report failed' });
  }
});

module.exports = router;
