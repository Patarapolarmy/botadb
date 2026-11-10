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
  const token = jwt.sign({ uid: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE, token, cookieOpts);
  res.json({ ok: true });
});

// POST /admin/logout
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

module.exports = router;
module.exports.requireAdmin = requireAdmin;
