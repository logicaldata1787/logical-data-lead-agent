'use strict';

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const leadRoutes = require('./routes/leads');
const campaignRoutes = require('./routes/campaigns');
const unsubscribeRoutes = require('./routes/unsubscribe');
const emailSettingsRoutes = require('./routes/emailSettings');
const analyticsRoutes = require('./routes/analytics');
const { isDemoMode } = require('./services/mailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Disable Helmet CSP so our simple demo UI can run inline scripts.
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cors());
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', demoMode: isDemoMode() });
});

// Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  })
);

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/unsubscribe', unsubscribeRoutes);
app.use('/api/email-settings', emailSettingsRoutes);
app.use('/api/analytics', analyticsRoutes);

// Serve demo UI at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  if (isDemoMode()) {
    console.log('DEMO_MODE: enabled — email sends are simulated, no SMTP credentials required');
  }
});
