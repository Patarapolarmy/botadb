// index.js
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { checkApiKey, checkJwt } = require('./middleware');

const app = express();
app.use(express.json());
app.use(cookieParser());

const secret = process.env.JWT_SECRET;
const port = process.env.PORT || 3000;

function clientIp(req) {
  const raw = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  return raw.includes(',') ? raw.split(',')[0].trim() : raw.replace(/^::ffff:/, '');
}

// === Issue JWT (bot) ===
app.post('/api/get-token', checkApiKey, (req, res) => {
  const ip = clientIp(req);
  const key = req.header('x-api-key');
  const accessToken = jwt.sign({ key, ip, time: Date.now() }, secret, { expiresIn: '24h', audience: 'bot' });
  res.json({
    status: 'true',
    message: 'API is running',
    accesstoken: accessToken,
    ip,
    timestamp: new Date().toISOString(),
  });
});

// === ADB commands (bot) ===
app.post('/api/get-commands', checkApiKey, checkJwt, (req, res) => {
  const { serial } = req.body || {};
  if (!serial) return res.status(400).json({ error: 'Missing device information' });
  res.json({
    status: 'true',
    message: 'API is running',
    ip: req.jwt.ip,
    serial,
    commands: [
      { command: 'settings', args: ['put', 'global', 'development_settings_enabled', '0'] },
      { command: 'settings', args: ['put', 'global', 'adb_enabled', '2'] },
    ],
    timestamp: new Date().toISOString(),
  });
});

// === open (etag) ===
app.post('/api/open', checkApiKey, (req, res) => {
  const data = { status: 'true', message: 'API is running' };
  const etag = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  res.set('ETag', etag);
  res.json(data);
});

// === bot + app + admin routers ===
app.use('/api', require('./routes/bot'));
app.use('/admin', require('./routes/admin'));
app.use(express.static('public', {
  setHeaders: (res, p) => {
    if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  },
}));
app.get('/admin', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(require('path').join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => res.send('OK'));

if (require.main === module) {
  app.listen(port, () => console.log(`Server is running on port ${port}`));
}

module.exports = app;
