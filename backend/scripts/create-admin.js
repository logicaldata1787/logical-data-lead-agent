#!/usr/bin/env node
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const prisma = require('../db/prisma');

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || 'Admin';
  if (!email || !password) {
    console.error('Usage: node create-admin.js <email> <password> [name]');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), passwordHash: hash, name, role: 'admin' },
    update: { passwordHash: hash, role: 'admin', isActive: true },
  });
  console.log('✅ Admin user created/updated:', user.email, '(id:', user.id + ')');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
