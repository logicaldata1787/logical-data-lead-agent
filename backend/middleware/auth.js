'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

let _secret = JWT_SECRET;
if (!_secret) {
  if (process.env.NODE_ENV === 'production') {
    _secret = `ephemeral-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    console.error('WARNING: JWT_SECRET is not set in production. Using ephemeral in-memory secret; set JWT_SECRET to avoid session invalidation on restart.');
  } else {
    console.warn('WARNING: JWT_SECRET is not set. Using an insecure default for development only.');
    _secret = 'dev-secret-change-me-do-not-use-in-production';
  }
}

function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, _secret);
    next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ ok: false, error: 'Admin required' });
  next();
}

function signToken(payload) {
  return jwt.sign(payload, _secret, { expiresIn: '7d' });
}

module.exports = { requireAuth, requireAdmin, signToken };
