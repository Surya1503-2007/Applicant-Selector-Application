/**
 * @file answerRoutes.js
 * @description Express router exposing the answer scoring endpoint for Part 3.
 */

const express = require('express');
const { scoreAndSaveResponse } = require('../services/answerScoringService');

const router = express.Router();

/**
 * POST /api/answers
 * Evaluates a candidate's free-text answer for a question within an interview session,
 * persists the scores via Part 1's addResponse(), and returns the explainable result.
 * Body: { sessionId: string, questionId: string, answerText: string }
 */
router.post('/answers', async (req, res) => {
  try {
    const { sessionId, questionId, answerText } = req.body || {};

    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      return res.status(400).json({
        error: 'Invalid or missing sessionId. Must be a non-empty string.',
      });
    }

    if (!questionId || typeof questionId !== 'string' || !questionId.trim()) {
      return res.status(400).json({
        error: 'Invalid or missing questionId. Must be a non-empty string.',
      });
    }

    if (typeof answerText !== 'string') {
      return res.status(400).json({
        error: 'Invalid or missing answerText. Must be a string (empty string allowed for NO_ANSWER).',
      });
    }

    const result = await scoreAndSaveResponse(sessionId.trim(), questionId.trim(), answerText);
    return res.status(201).json(result);
  } catch (error) {
    if (error.statusCode === 404 || (error.message && error.message.includes('not found'))) {
      return res.status(404).json({ error: error.message });
    }
    if (error.statusCode === 409 || error.code === 'P2002') {
      return res.status(409).json({ error: error.message });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({
      error: 'Failed to score and save answer.',
      details: error.message,
    });
  }
});

module.exports = router;

