'use strict';

/**
 * Tests for the email sending worker helpers.
 * - personalize() template engine
 * - addUnsubscribeFooter() compliance footer (unsubscribe link + mailing address)
 */

describe('worker – template helpers', () => {
  let worker;

  function loadFresh() {
    jest.resetModules();
    worker = require('../services/worker');
  }

  afterEach(() => {
    delete process.env.MAILING_ADDRESS;
    delete process.env.APP_URL;
    jest.resetModules();
  });

  // ─── personalize ─────────────────────────────────────────────────────────────

  describe('personalize()', () => {
    beforeEach(loadFresh);

    test('replaces known variables', () => {
      const result = worker.personalize('Hello {{first_name}} from {{company}}', {
        first_name: 'Alice',
        company: 'Acme',
      });
      expect(result).toBe('Hello Alice from Acme');
    });

    test('replaces unknown variables with empty string', () => {
      const result = worker.personalize('Hi {{unknown_var}}!', {});
      expect(result).toBe('Hi !');
    });

    test('leaves template unchanged when no variables', () => {
      const result = worker.personalize('No vars here', { first_name: 'Alice' });
      expect(result).toBe('No vars here');
    });
  });

  // ─── addUnsubscribeFooter ────────────────────────────────────────────────────

  describe('addUnsubscribeFooter()', () => {
    test('includes the unsubscribe link with the token', () => {
      process.env.APP_URL = 'https://example.com';
      loadFresh();
      const html = worker.addUnsubscribeFooter('<p>Email body</p>', 'abc123token');
      expect(html).toContain('/unsubscribe?token=abc123token');
    });

    test('includes the unsubscribe anchor text', () => {
      process.env.APP_URL = 'https://example.com';
      loadFresh();
      const html = worker.addUnsubscribeFooter('<p>Email body</p>', 'tok');
      expect(html).toContain('Unsubscribe');
    });

    test('includes a mailing address (default placeholder)', () => {
      loadFresh();
      const html = worker.addUnsubscribeFooter('<p>Email body</p>', 'tok');
      // Default address placeholder contains "Main St" or is non-empty
      expect(html).toMatch(/Main St|Company Name|\d{5}/);
    });

    test('uses custom MAILING_ADDRESS env var when set', () => {
      process.env.MAILING_ADDRESS = '42 Custom Blvd, Testville, TX 77001, US';
      loadFresh();
      const html = worker.addUnsubscribeFooter('<p>Email body</p>', 'tok');
      expect(html).toContain('42 Custom Blvd, Testville, TX 77001, US');
    });

    test('appends footer after the original html', () => {
      process.env.APP_URL = 'https://example.com';
      loadFresh();
      const body = '<p>Original</p>';
      const html = worker.addUnsubscribeFooter(body, 'tok');
      expect(html.startsWith(body)).toBe(true);
    });
  });
});
