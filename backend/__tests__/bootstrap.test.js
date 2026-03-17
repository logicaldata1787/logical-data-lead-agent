'use strict';

const { ensureBootstrapAdmin, getBootstrapConfig } = require('../services/bootstrap');

describe('bootstrap admin service', () => {
  test('getBootstrapConfig enables only when email and password exist', () => {
    const cfg = getBootstrapConfig({ BOOTSTRAP_ADMIN_EMAIL: 'Admin@Test.com ', BOOTSTRAP_ADMIN_PASSWORD: 'secret123' });
    expect(cfg.enabled).toBe(true);
    expect(cfg.email).toBe('admin@test.com');
  });

  test('ensureBootstrapAdmin skips when vars missing', async () => {
    const res = await ensureBootstrapAdmin({
      env: {},
      prismaClient: {},
      bcryptLib: {},
      logger: { log: jest.fn(), error: jest.fn() },
    });
    expect(res.skipped).toBe(true);
  });

  test('ensureBootstrapAdmin rejects short password', async () => {
    const logger = { log: jest.fn(), error: jest.fn() };
    const res = await ensureBootstrapAdmin({
      env: { BOOTSTRAP_ADMIN_EMAIL: 'a@test.com', BOOTSTRAP_ADMIN_PASSWORD: '123' },
      prismaClient: { user: { upsert: jest.fn() } },
      bcryptLib: { hash: jest.fn() },
      logger,
    });
    expect(res.ok).toBe(false);
    expect(logger.error).toHaveBeenCalled();
  });

  test('ensureBootstrapAdmin upserts admin when configured', async () => {
    const upsert = jest.fn(async () => ({ id: 'u1', email: 'admin@test.com' }));
    const hash = jest.fn(async () => 'hashed');
    const res = await ensureBootstrapAdmin({
      env: { BOOTSTRAP_ADMIN_EMAIL: 'admin@test.com', BOOTSTRAP_ADMIN_PASSWORD: 'strongPass123', BOOTSTRAP_ADMIN_NAME: 'Admin' },
      prismaClient: { user: { upsert } },
      bcryptLib: { hash },
      logger: { log: jest.fn(), error: jest.fn() },
    });

    expect(hash).toHaveBeenCalled();
    expect(upsert).toHaveBeenCalled();
    expect(res.skipped).toBe(false);
    expect(res.email).toBe('admin@test.com');
  });
});
