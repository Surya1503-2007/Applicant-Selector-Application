/**
 * @file app.js
 * @description Express application setup for RAC DRDO Adaptive Interview System API.
 */

const express = require('express');
const skillMatchRoutes = require('./routes/skillMatchRoutes');

const app = express();

// Middleware
app.use(express.json());

// API Routes
app.use('/api', skillMatchRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'RAC DRDO Skill-Match Engine' });
});

// Fallback 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

module.exports = app;

