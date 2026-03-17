'use strict';

const bcrypt = require('bcryptjs');
const prisma = require('../db/prisma');

function getBootstrapConfig(env = process.env) {
  const email = typeof env.BOOTSTRAP_ADMIN_EMAIL === 'string' ? env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase() : '';
  const password = typeof env.BOOTSTRAP_ADMIN_PASSWORD === 'string' ? env.BOOTSTRAP_ADMIN_PASSWORD : '';
  const name = typeof env.BOOTSTRAP_ADMIN_NAME === 'string' && env.BOOTSTRAP_ADMIN_NAME.trim()
    ? env.BOOTSTRAP_ADMIN_NAME.trim()
    : 'Admin';

  return { email, password, name, enabled: Boolean(email && password) };
}

async function ensureBootstrapAdmin({ prismaClient = prisma, bcryptLib = bcrypt, env = process.env, logger = console } = {}) {
  const cfg = getBootstrapConfig(env);
  if (!cfg.enabled) return { ok: true, skipped: true, reason: 'bootstrap env vars not configured' };

  if (cfg.password.length < 8) {
    logger.error('BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters. Skipping bootstrap admin creation.');
    return { ok: false, skipped: true, reason: 'password too short' };
  }

  const passwordHash = await bcryptLib.hash(cfg.password, 12);
  const user = await prismaClient.user.upsert({
    where: { email: cfg.email },
    create: { email: cfg.email, passwordHash, name: cfg.name, role: 'admin', isActive: true },
    update: { passwordHash, name: cfg.name, role: 'admin', isActive: true },
    select: { id: true, email: true },
  });

  logger.log(`Bootstrap admin ready: ${user.email}`);
  return { ok: true, skipped: false, userId: user.id, email: user.email };
}

module.exports = { ensureBootstrapAdmin, getBootstrapConfig };
