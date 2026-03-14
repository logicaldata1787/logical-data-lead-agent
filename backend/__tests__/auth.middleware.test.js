'use strict';

/**
 * Tests for JWT auth middleware and helpers.
 */

describe('auth middleware', () => {
  let auth;

  function loadFresh() {
    jest.resetModules();
    auth = require('../middleware/auth');
  }

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-for-unit-tests-only';
    loadFresh();
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    jest.resetModules();
  });

  // ─── signToken ──────────────────────────────────────────────────────────────

  describe('signToken()', () => {
    test('returns a non-empty string', () => {
      const token = auth.signToken({ id: 'u1', email: 'a@b.com', role: 'user' });
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(20);
    });

    test('encodes the payload in the token', () => {
      const jwt = require('jsonwebtoken');
      const token = auth.signToken({ id: 'u1', role: 'admin' });
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.id).toBe('u1');
      expect(decoded.role).toBe('admin');
    });
  });

  // ─── requireAuth ────────────────────────────────────────────────────────────

  describe('requireAuth()', () => {
    function makeReqRes(token) {
      const req = { headers: { authorization: token ? `Bearer ${token}` : '' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();
      return { req, res, next };
    }

    test('calls next() with valid token and sets req.user', () => {
      const token = auth.signToken({ id: 'u1', role: 'user' });
      const { req, res, next } = makeReqRes(token);
      auth.requireAuth(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user.id).toBe('u1');
    });

    test('returns 401 when no token provided', () => {
      const { req, res, next } = makeReqRes(null);
      auth.requireAuth(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('returns 401 with invalid token', () => {
      const { req, res, next } = makeReqRes('invalid.token.here');
      auth.requireAuth(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  // ─── requireAdmin ────────────────────────────────────────────────────────────

  describe('requireAdmin()', () => {
    test('calls next() when user is admin', () => {
      const req = { user: { role: 'admin' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      auth.requireAdmin(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('returns 403 when user is not admin', () => {
      const req = { user: { role: 'user' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      auth.requireAdmin(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
