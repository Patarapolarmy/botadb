// index.js
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// === ตั้งค่า ===
const API_KEYS = [
  '9e4609b2-c052-41c7-b7bc-94df2ae9a0ea',
  'key-xyz-456',
  'key-demo-789'
];

const ALLOWED_IPS = ['127.0.0.1', '1.2.3.4','104.28.214.144'];

// === Middleware ตรวจสอบ API Key และ IP ===
function checkApiKeyAndIP(req, res, next) {
  const key = req.header('x-api-key');
  const ipRaw = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ip = ipRaw.includes(',') ? ipRaw.split(',')[0].trim() : ipRaw.replace(/^::ffff:/, '');

  if (!API_KEYS.includes(key)) {
    return res.status(401).json({ error: 'Unauthorized - Invalid API Key' });
  }

  if (!ALLOWED_IPS.includes(ip)) {
    return res.status(403).json({ error: `Forbidden - IP ${ip} is not allowed` });
  }

  next();
}

// === Protected route ===
app.post('/api/status', checkApiKeyAndIP, (req, res) => {
  const ipRaw = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ip = ipRaw.includes(',') ? ipRaw.split(',')[0].trim() : ipRaw.replace(/^::ffff:/, '');
  res.json({
    status: 'true',
    message: 'API is running',
    ip,
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.send('OK');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});