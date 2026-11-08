/**
 * @file prismaClient.js
 * @description Shared singleton instance of the Prisma Client.
 * Ensures that multiple database connections are not spawned across services.
 */

const { PrismaClient } = require('@prisma/client');

// Global Prisma Client instance
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

module.exports = prisma;

