// authConfig.js
// Configuration for authentication and rate limiting
// All values are injectable via environment variables for flexibility.

/**
 * JWT secret used to sign and verify tokens. Must be a strong secret.
 * Set via AUTH_JWT_SECRET env var; fallback to a development placeholder.
 */
const JWT_SECRET = process.env.AUTH_JWT_SECRET || "dev-secret-change-me";

/**
 * JWT expiration time (e.g., '2h', '30m'). Configurable via AUTH_JWT_EXPIRES.
 */
const JWT_EXPIRES_IN = process.env.AUTH_JWT_EXPIRES || "2h";

/**
 * Maximum number of failed login attempts before lockout.
 */
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.AUTH_MAX_LOGIN_ATTEMPTS, 10) || 5;

/**
 * Lockout duration in seconds after exceeding failed attempts.
 */
const LOCKOUT_DURATION_SECONDS = parseInt(process.env.AUTH_LOCKOUT_DURATION, 10) || 300; // 5 minutes

/**
 * In‑memory map for tracking login attempts per username.
 * Structure: { [username]: { attempts: number, lockedUntil: Date|null } }
 */
const loginAttempts = {};

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_SECONDS,
  loginAttempts,
};

