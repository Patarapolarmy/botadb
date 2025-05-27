// index.js
const express = require('express');
const app = express();
app.use(express.json());
const jwt = require('jsonwebtoken');
const secret = 'k9xarmy1234567890'; // ควรเก็บไว้ใน .env
const port = process.env.PORT || 3000;

// === ตั้งค่า ===
const API_KEYS = [
  '9e4609b2-c052-41c7-b7bc-94df2ae9a0ea',
];

const ALLOWED_IPS = ['127.0.0.1','104.28.214.144','125.26.172.184'];



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
app.post('/api/get-token', checkApiKeyAndIP, (req, res) => {
  const ipRaw = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ip = ipRaw.includes(',') ? ipRaw.split(',')[0].trim() : ipRaw.replace(/^::ffff:/, '');
  const key = req.header('x-api-key');

    // สร้าง payload
  const payload = {
        key: key,
        ip : ip,
        time: Date.now()
  };
  // สร้าง token (มีอายุ 10 นาที)
  const accessToken = jwt.sign(payload, secret, { expiresIn: '24h' });
  res.json({
    status: 'true',
    message: 'API is running',
    accesstoken: accessToken,
    ip,
    timestamp: new Date().toISOString()
  });
});





app.post('/api/get-commands', checkApiKeyAndIP, (req, res) => {

    const authHeader = req.header('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Missing token' });
    }

    const { serial } = req.body || {};

    if (!serial) {
        return res.status(400).json({ error: 'Missing device information' });
    }

    try {
        const decoded = jwt.verify(token, secret); // ตรวจสอบและ decode
        const ip = decoded.ip; // ดึง IP จาก payload
          res.json({
            status: 'true',
            message: 'API is running',
            ip,
            serial,
            commands: [
                { "command": 'settings', "args": ["put", "global", "development_settings_enabled", "0"] },
                {  "command": "settings", "args": ["put", "global", "adb_enabled", "2"]}
            ],
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
        

});

app.get('/', (req, res) => {
  res.send('OK');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});