const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// constant-time string compare; false unless both are equal non-empty strings
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length === 0 || a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// API key for bot + app routes (env-driven, fail-closed)
function checkApiKey(req, res, next) {
  const key = req.header('x-api-key');
  if (!safeEqual(key, process.env.API_KEY)) {
    return res.status(401).json({ error: 'Unauthorized - Invalid API Key' });
  }
  next();
}

// Bearer JWT for bot routes; sets req.jwt
function checkJwt(req, res, next) {
  const auth = req.header('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }
  const token = auth.slice(7);
  try {
    req.jwt = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Admin login cookie for /admin/api routes; sets req.admin
function requireAdmin(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid session' });
  }
}

module.exports = { checkApiKey, checkJwt, requireAdmin };
