/**
 * @file interviewRoutes.js
 * @description Express router exposing endpoints for conducting adaptive interview sessions.
 */

const express = require('express');
const interviewService = require('../services/interviewService');

const router = express.Router();

/**
 * POST /api/interviews/start
 * Initializes an interview session, computes skill-match, and delivers the first question.
 * Body: { candidateId: string, postId: string }
 */
router.post('/start', async (req, res) => {
  try {
    const { candidateId, postId } = req.body;

    if (!candidateId || typeof candidateId !== 'string') {
      return res.status(400).json({ error: 'candidateId is required and must be a string.' });
    }
    if (!postId || typeof postId !== 'string') {
      return res.status(400).json({ error: 'postId is required and must be a string.' });
    }

    const result = await interviewService.startInterview(candidateId, postId);
    return res.status(201).json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      error: error.message || 'Failed to start interview session.',
    });
  }
});

/**
 * GET /api/interviews/:sessionId/question
 * Retrieves the currently active pending question for the session. Idempotent.
 */
router.get('/:sessionId/question', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await interviewService.getCurrentQuestion(sessionId);
    return res.status(200).json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      error: error.message || 'Failed to retrieve active question.',
    });
  }
});

/**
 * POST /api/interviews/:sessionId/answer
 * Submits an answer to the pending question, evaluates it, and triggers adaptive transition.
 * Body: { answerText: string }
 */
router.post('/:sessionId/answer', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { answerText } = req.body;

    if (answerText === undefined || typeof answerText !== 'string') {
      return res.status(400).json({ error: 'answerText is required and must be a string.' });
    }

    const result = await interviewService.submitAnswer(sessionId, answerText);
    return res.status(200).json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      error: error.message || 'Failed to process answer submission.',
    });
  }
});

/**
 * GET /api/interviews/:sessionId/state
 * Retrieves the complete interview state machine snapshot and chronological DecisionLog audit trail.
 */
router.get('/:sessionId/state', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await interviewService.getInterviewState(sessionId);
    return res.status(200).json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      error: error.message || 'Failed to retrieve interview state.',
    });
  }
});

/**
 * POST /api/interviews/:sessionId/end
 * Manually concludes an ongoing interview session (board termination).
 * Body: { reason?: string }
 */
router.post('/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body || {};

    const result = await interviewService.endInterviewEarly(sessionId, reason);
    return res.status(200).json({
      success: true,
      sessionId,
      status: result.status,
      endReason: result.endReason,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      error: error.message || 'Failed to terminate interview session.',
    });
  }
});

/**
 * POST /api/interviews/:sessionId/expert-question
 * Live-injects an expert question into the active interview session.
 * Body: { questionText, topicId?, difficulty?, idealAnswer, keywords[], createdById? }
 */
router.post('/:sessionId/expert-question', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { questionText, topicId, difficulty, idealAnswer, keywords, createdById } = req.body || {};

    const result = await interviewService.injectExpertQuestion(sessionId, {
      questionText,
      topicId,
      difficulty,
      idealAnswer,
      keywords,
      createdById,
    });

    return res.status(201).json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      error: error.message || 'Failed to inject expert question.',
    });
  }
});

module.exports = router;

