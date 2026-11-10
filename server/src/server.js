/**
 * @file server.js
 * @description HTTP server entry point for RAC DRDO Interview System API.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = require('./app');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 RAC DRDO Skill-Match Server running on port ${PORT}`);
  console.log(`👉 POST http://localhost:${PORT}/api/skill-match`);
  console.log(`👉 POST http://localhost:${PORT}/api/candidates/:id/skills`);
});

module.exports = server;

