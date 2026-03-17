'use strict';

describe('worker runtime hardening', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  test('processEnrollments handles prisma init failures without throwing', async () => {
    jest.doMock('../db/prisma', () => {
      throw new Error('Missing DATABASE_URL');
    });
    jest.doMock('../services/sender', () => ({ sendEmail: jest.fn() }));

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const worker = require('../services/worker');

    await expect(worker.processEnrollments()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});
