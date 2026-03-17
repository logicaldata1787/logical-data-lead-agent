'use strict';

const http = require('http');

describe('server health endpoint', () => {
  let server;

  beforeAll((done) => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.DEMO_MODE = 'true';
    process.env.DATABASE_URL = 'postgres://invalid:invalid@localhost:5432/invalid';

    const app = require('../server');
    server = app.listen(0, done);
  });

  afterAll((done) => {
    delete process.env.JWT_SECRET;
    delete process.env.DEMO_MODE;
    delete process.env.DATABASE_URL;
    server.close(done);
  });

  test('GET /health returns UP with demoMode status', (done) => {
    const { port } = server.address();

    http.get(`http://127.0.0.1:${port}/health`, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        expect(res.statusCode).toBe(200);
        const parsed = JSON.parse(body);
        expect(parsed).toEqual({ status: 'UP', demoMode: true });
        done();
      });
    }).on('error', done);
  });
});
