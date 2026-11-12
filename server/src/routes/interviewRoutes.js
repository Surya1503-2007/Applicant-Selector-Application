/**
 * @file interviewRoutes.js
 * @description Express router for adaptive interview execution and session lifecycle.
 */

const express = require('express');
const {
  getNextInterviewQuestion,
  terminateSessionEarly,
} = require('../services/adaptiveEngineService');

const router = express.Router();

/**
 * GET /api/interviews/:sessionId/question
 * Retrieves the current pending question for the interview session.
 * Refresh-safe: returns the identical question upon reload until an answer is submitted.
 */
router.get('/interviews/:sessionId/question', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' });
    }

    const payload = await getNextInterviewQuestion(sessionId);
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to retrieve next interview question.',
      details: error.message,
    });
  }
});

/**
 * POST /api/interviews/:sessionId/terminate
 * Concludes the interview session early with an examiner rationale.
 * Body: { reason: string }
 */
router.post('/interviews/:sessionId/terminate', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' });
    }

    const result = await terminateSessionEarly(sessionId, reason);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to terminate interview early.',
      details: error.message,
    });
  }
});

module.exports = router;

