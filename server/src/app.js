/**
 * @file app.js
 * @description Express application setup for RAC DRDO Adaptive Interview System API.
 */

const express = require('express');
const skillMatchRoutes = require('./routes/skillMatchRoutes');
const answerRoutes = require('./routes/answerRoutes');
const postRoutes = require('./routes/postRoutes');
const candidateRoutes = require('./routes/candidateRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const reportRoutes = require('./routes/reportRoutes');
const questionRoutes = require('./routes/questionRoutes');

const app = express();

// CORS Middleware: Allow Vite development origins and standard dev hosts
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ];
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Middleware
app.use(express.json());

// API Routes
app.use('/api', skillMatchRoutes);
app.use('/api', answerRoutes);
app.use('/api', postRoutes);
app.use('/api', candidateRoutes);
app.use('/api', sessionRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api', questionRoutes);
app.use('/api', reportRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'RAC DRDO Skill-Match Engine' });
});

// Fallback 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

module.exports = app;

