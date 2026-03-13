'use strict';

/**
 * Tests for Demo Mode in the mailer service.
 */

describe('mailer – Demo Mode', () => {
  let mailer;

  function loadFresh() {
    jest.resetModules();
    mailer = require('../services/mailer');
  }

  afterEach(() => {
    delete process.env.DEMO_MODE;
    jest.resetModules();
  });

  describe('isDemoMode()', () => {
    test('returns false when DEMO_MODE is not set', () => {
      loadFresh();
      expect(mailer.isDemoMode()).toBe(false);
    });

    test.each(['true', 'TRUE', '1', 'yes', 'YES'])(
      'returns true when DEMO_MODE="%s"',
      (value) => {
        process.env.DEMO_MODE = value;
        loadFresh();
        expect(mailer.isDemoMode()).toBe(true);
      }
    );

    test('returns false when DEMO_MODE="false"', () => {
      process.env.DEMO_MODE = 'false';
      loadFresh();
      expect(mailer.isDemoMode()).toBe(false);
    });
  });

  describe('getPublicEmailSettings() in demo mode', () => {
    beforeEach(() => {
      process.env.DEMO_MODE = 'true';
      // No SMTP vars configured
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      delete process.env.MAIL_FROM;
      loadFresh();
    });

    test('reports configured: true even without SMTP vars', () => {
      expect(mailer.getPublicEmailSettings().configured).toBe(true);
    });

    test('includes demo: true flag', () => {
      expect(mailer.getPublicEmailSettings().demo).toBe(true);
    });
  });

  describe('getPublicEmailSettings() outside demo mode', () => {
    beforeEach(() => {
      delete process.env.DEMO_MODE;
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      loadFresh();
    });

    test('reports configured: false without SMTP vars', () => {
      expect(mailer.getPublicEmailSettings().configured).toBe(false);
    });

    test('does not include demo flag', () => {
      expect(mailer.getPublicEmailSettings().demo).toBeUndefined();
    });
  });

  describe('sendMail() in demo mode', () => {
    beforeEach(() => {
      process.env.DEMO_MODE = 'true';
      loadFresh();
    });

    test('resolves without connecting to SMTP', async () => {
      // If this actually attempted SMTP it would throw (no host/user/pass).
      await expect(
        mailer.sendMail({ to: 'test@example.com', subject: 'Hello', text: 'World' })
      ).resolves.toBeDefined();
    });

    test('returns demo: true in the result', async () => {
      const result = await mailer.sendMail({
        to: 'test@example.com',
        subject: 'Hello',
        text: 'World',
      });
      expect(result.demo).toBe(true);
    });

    test('includes recipient in accepted list', async () => {
      const result = await mailer.sendMail({
        to: 'test@example.com',
        subject: 'Hello',
        text: 'World',
      });
      expect(result.accepted).toContain('test@example.com');
    });
  });

  describe('sendMail() outside demo mode (real SMTP path)', () => {
    beforeEach(() => {
      delete process.env.DEMO_MODE;
      loadFresh();
    });

    test('throws when SMTP credentials are missing', async () => {
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      await expect(
        mailer.sendMail({ to: 'test@example.com', subject: 'Hi', text: 'body' })
      ).rejects.toThrow(/SMTP_USER|SMTP_PASS/);
    });
  });
});
