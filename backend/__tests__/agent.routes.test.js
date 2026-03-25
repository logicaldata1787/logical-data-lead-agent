'use strict';

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { id: 'user-1', role: 'admin' };
    next();
  },
}));

jest.mock('../services/eventLeadAgent', () => ({
  createLeadGenerationPlan: jest.fn(() => ({
    ok: true,
    event: { name: 'CES 2027' },
  })),
  createExecutableSequenceSteps: jest.fn(() => ([
    { stepNumber: 1, delayDays: 0, subject: 'S1', body: 'B1' },
  ])),
}));

const mockPrisma = {
  $transaction: jest.fn(),
};

jest.mock('../db/prisma', () => mockPrisma);

const router = require('../routes/agent');

function getHandler(path, method) {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function mockRes() {
  const res = { statusCode: 200 };
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn((obj) => { res.body = obj; return res; });
  return res;
}

describe('agent routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.HUGGING_FACE_TOKEN;
  });

  test('POST /event-plan returns 400 for missing event name', async () => {
    const handler = getHandler('/event-plan', 'post');
    const req = { body: {}, user: { id: 'user-1' } };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.ok).toBe(false);
  });

  test('POST /event-plan/execute enrolls and skips suppressed contacts', async () => {
    const handler = getHandler('/event-plan/execute', 'post');

    const tx = {
      event: { create: jest.fn(async () => ({ id: 'evt-1' })) },
      sequence: { create: jest.fn(async () => ({ id: 'seq-1', steps: [{ delayDays: 0 }] })), findFirst: jest.fn() },
      contact: {
        findMany: jest.fn(async () => ([{ id: 'c1' }, { id: 'c2' }])),
        findUnique: jest.fn(async ({ where }) => {
          if (where.id === 'c1') return { id: 'c1', email: 'ok@test.com', doNotContact: false, unsubscribed: false };
          if (where.id === 'c2') return { id: 'c2', email: 'sup@test.com', doNotContact: false, unsubscribed: false };
          return null;
        }),
      },
      suppression: {
        findUnique: jest.fn(async ({ where }) => where.email === 'sup@test.com' ? { id: 's1' } : null),
      },
      enrollment: { upsert: jest.fn(async () => ({})) },
      activityLog: { create: jest.fn(async () => ({})) },
    };

    mockPrisma.$transaction.mockImplementation(async (cb) => cb(tx));

    const req = {
      body: { eventName: 'CES 2027', contactIds: ['c1', 'c2'] },
      user: { id: 'user-1' },
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.execution.enrolled).toBe(1);
    expect(res.body.execution.skipped).toBe(1);
    expect(tx.enrollment.upsert).toHaveBeenCalledTimes(1);
    expect(tx.activityLog.create).toHaveBeenCalledTimes(1);
  });

  test('POST /media/generate returns real-time image url', async () => {
    const handler = getHandler('/media/generate', 'post');
    const req = {
      body: { prompt: 'a sunset over mountains', type: 'image', language: 'both', seed: 7 },
      user: { id: 'user-1' },
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.realtime).toBe(true);
    expect(res.body.download.url).toContain('image.pollinations.ai');
  });

  test('POST /media/generate video returns 503 when provider token missing', async () => {
    const handler = getHandler('/media/generate', 'post');
    const req = {
      body: { prompt: 'festival clip', type: 'video', language: 'english' },
      user: { id: 'user-1' },
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.reason).toBe('missing_hf_token');
  });
});
