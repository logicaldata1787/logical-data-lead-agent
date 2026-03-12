'use strict';

const express = require('express');
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

const app = express(app.get('/health', (req, res) => res.json({ ok: true })););
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
});
app.use(limiter);

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/unsubscribe', unsubscribeRoutes);
app.use('/api/email-settings', emailSettingsRoutes);
app.use('/api/analytics', analyticsRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
