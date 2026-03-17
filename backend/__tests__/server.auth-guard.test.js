'use strict';

const http = require('http');

function requestJson({ method, port, path, token, payload }) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data ? JSON.parse(data) : null });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

describe('server auth guards', () => {
  let server;

  beforeAll((done) => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.DEMO_MODE = 'true';
    process.env.DATABASE_URL = 'postgres://invalid:invalid@localhost:5432/invalid';

    jest.resetModules();
    const app = require('../server');
    server = app.listen(0, done);
  });

  afterAll((done) => {
    delete process.env.JWT_SECRET;
    delete process.env.DEMO_MODE;
    delete process.env.DATABASE_URL;
    server.close(done);
  });

  test('GET /api/auth/me without token returns 401', async () => {
    const { port } = server.address();
    const response = await requestJson({ method: 'GET', port, path: '/api/auth/me' });
    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ ok: false, error: 'Unauthorized' });
  });

  test('POST /api/auth/logout without token returns 401', async () => {
    const { port } = server.address();
    const response = await requestJson({ method: 'POST', port, path: '/api/auth/logout' });
    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ ok: false, error: 'Unauthorized' });
  });

  test('GET /api/contacts without token returns 401', async () => {
    const { port } = server.address();
    const response = await requestJson({ method: 'GET', port, path: '/api/contacts' });
    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ ok: false, error: 'Unauthorized' });
  });
});
