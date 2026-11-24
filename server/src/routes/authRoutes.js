/**
 * @file authRoutes.js
 * @description Authentication router for RAC DRDO Adaptive Interview System (Part 7A).
 * Handles examiner and admin login, logout, session verification (/me), and rate-limiting lockout.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prismaClient');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_SECONDS,
  loginAttempts,
} = require('../config/authConfig');

const router = express.Router();

/**
 * POST /api/auth/login
 * Authenticates user credentials with rate-limiting protection.
 * Sets signed JWT in httpOnly cookie 'rac_token'.
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const cleanUsername = String(username).trim().toLowerCase();

    // 1. Check Rate-Limiting & Lockout
    const attemptRecord = loginAttempts[cleanUsername] || { attempts: 0, lockedUntil: null };
    const now = new Date();

    if (attemptRecord.lockedUntil && attemptRecord.lockedUntil > now) {
      const waitSeconds = Math.ceil((attemptRecord.lockedUntil - now) / 1000);
      return res.status(429).json({
        error: `Account temporarily locked due to excessive failed attempts. Please retry in ${waitSeconds} seconds.`,
      });
    }

    // 2. Fetch User by unique username
    const user = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });

    // 3. Verify password hash using bcryptjs
    const isValid = user && user.isActive && bcrypt.compareSync(password, user.passwordHash);

    if (!isValid) {
      // Record failed attempt
      attemptRecord.attempts += 1;
      if (attemptRecord.attempts >= MAX_LOGIN_ATTEMPTS) {
        attemptRecord.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_SECONDS * 1000);
      }
      loginAttempts[cleanUsername] = attemptRecord;

      return res.status(401).json({
        error: 'Invalid credentials. Please verify username and password.',
      });
    }

    // 4. Success: Clear failed attempts
    delete loginAttempts[cleanUsername];

    // 5. Sign JWT token
    const tokenPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    // 6. Set secure httpOnly cookie
    res.cookie('rac_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
    });

    return res.status(200).json({
      message: 'Authentication successful.',
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Authentication processing failed.',
      details: error.message,
    });
  }
});

/**
 * GET /api/auth/me
 * Retrieves profile of currently authenticated user session.
 */
router.get('/me', requireAuth(), (req, res) => {
  return res.status(200).json({
    user: req.user,
  });
});

/**
 * POST /api/auth/logout
 * Clears authentication cookie.
 */
router.post('/logout', (req, res) => {
  res.clearCookie('rac_token');
  return res.status(200).json({
    message: 'Logged out successfully.',
  });
});

module.exports = router;

