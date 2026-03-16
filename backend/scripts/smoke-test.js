#!/usr/bin/env node
'use strict';

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = Number(process.env.SMOKE_PORT || 3210);
const HOST = '127.0.0.1';
const SERVER_PATH = path.join(__dirname, '..', 'server.js');

function request(pathname, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: HOST, port: PORT, path: pathname, method }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = body ? JSON.parse(body) : null;
        } catch {
          parsed = body;
        }
        resolve({ statusCode: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function waitForServer(timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await request('/health');
      if (res.statusCode === 200) return res;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server did not become ready on port ${PORT} within ${timeoutMs}ms`);
}

async function main() {
  const child = spawn(process.execPath, [SERVER_PATH], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'development',
      DEMO_MODE: 'true',
      DISABLE_WORKER: 'true',
      JWT_SECRET: process.env.JWT_SECRET || 'smoke-test-secret',
      DATABASE_URL: process.env.DATABASE_URL || 'postgres://invalid:invalid@localhost:5432/invalid',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  try {
    const health = await waitForServer();
    if (health.body?.status !== 'UP') throw new Error(`Unexpected /health response: ${JSON.stringify(health.body)}`);

    const authMe = await request('/api/auth/me');
    if (authMe.statusCode !== 401) {
      throw new Error(`Expected 401 from /api/auth/me, got ${authMe.statusCode}`);
    }

    console.log('✅ Smoke test passed: server boot + /health + auth guard checks are healthy.');
  } finally {
    child.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('❌ Smoke test failed:', err.message);
  process.exit(1);
});
