'use strict';

const { PrismaClient } = require('@prisma/client');

function createUnavailablePrismaProxy(rootErrorMessage, path = 'prisma') {
  return new Proxy(function prismaUnavailableProxy() {}, {
    get(_target, prop) {
      if (prop === 'then') return undefined;
      return createUnavailablePrismaProxy(rootErrorMessage, `${path}.${String(prop)}`);
    },
    apply() {
      throw new Error(`${rootErrorMessage} (attempted to call ${path}())`);
    },
  });
}

let prisma;

try {
  prisma = global.__prisma || new PrismaClient();
  if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;
} catch (err) {
  const rootErrorMessage = `Prisma client is unavailable. Run \"prisma generate\" and ensure DATABASE_URL is configured. Original error: ${err.message}`;
  console.warn(rootErrorMessage);
  prisma = createUnavailablePrismaProxy(rootErrorMessage);
}

module.exports = prisma;
