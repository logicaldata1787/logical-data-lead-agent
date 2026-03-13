'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const contactRoutes = require('./routes/contacts');
const eventRoutes = require('./routes/events');
const sequenceRoutes = require('./routes/sequences');
const enrollmentRoutes = require('./routes/enrollments');
const emailAccountRoutes = require('./routes/emailAccounts');
const inboxRoutes = require('./routes/inbox');
const unsubscribeRoutes = require('./routes/unsubscribe');
const analyticsRoutes = require('./routes/analytics');
const apolloRoutes = require('./routes/apollo');
const emailSettingsRoutes = require('./routes/emailSettings');
const { isDemoMode } = require('./services/mailer');
const { startWorker } = require('./services/worker');

const app = express();
const PORT = process.env.PORT || 3000;

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });

app.use(helmet());
app.use(cors());
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', demoMode: isDemoMode() });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/sequences', sequenceRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/email-accounts', emailAccountRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/apollo', apolloRoutes);
app.use('/api/email-settings', emailSettingsRoutes);

// Unsubscribe (public, no /api prefix so link works)
app.use('/unsubscribe', unsubscribeRoutes);
// Also mount under /api for manual POST
app.use('/api/unsubscribe', unsubscribeRoutes);

// Legacy stubs kept for backward compatibility
app.use('/api/leads', (req, res) => res.json({ ok: true, message: 'Use /api/contacts' }));
app.use('/api/campaigns', (req, res) => res.json({ ok: true, message: 'Use /api/enrollments' }));

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start email sending worker and listen only when run directly
if (require.main === module) {
  if (process.env.DISABLE_WORKER !== 'true') {
    startWorker(Number(process.env.WORKER_INTERVAL_MS) || 60000);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    if (isDemoMode()) console.log('DEMO_MODE: enabled — email sends are simulated');
  });
}

module.exports = app;
