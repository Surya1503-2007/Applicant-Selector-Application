/**
 * @file reportRoutes.js
 * @description Express router exposing endpoints for RAC DRDO Part 5: Session Reports & Final Scoring.
 * Endpoints provide report generation, retrieval, board recommendation overrides,
 * remarks recording, and candidate ranking lists.
 */

const express = require('express');
const reportService = require('../services/reportService');

const router = express.Router();

/**
 * POST /api/interviews/:sessionId/report
 * Generates an immutable assessment report snapshot for a completed interview session.
 * Body: { regenerate?: boolean }
 */
router.post('/interviews/:sessionId/report', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { regenerate = false } = req.body || {};

    const report = await reportService.generateReport(sessionId, {
      regenerate: Boolean(regenerate),
    });

    return res.status(201).json(report);
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      error: error.message || 'Failed to generate assessment report.',
    });
  }
});

/**
 * GET /api/interviews/:sessionId/report
 * Retrieves full JSON report snapshot for a session (latest or specific version).
 * Query params: ?version=1
 */
router.get('/interviews/:sessionId/report', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { version } = req.query;

    const report = await reportService.getReport(sessionId, version);
    return res.status(200).json(report);
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      error: error.message || 'Failed to retrieve assessment report.',
    });
  }
});

/**
 * POST /api/interviews/:sessionId/report/override
 * Assessment board recommendation override.
 * Body: { newRecommendation: string, reason: string, remarks?: string, overriddenBy?: string }
 */
router.post('/interviews/:sessionId/report/override', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { newRecommendation, reason, remarks, overriddenBy } = req.body || {};

    if (!newRecommendation || typeof newRecommendation !== 'string') {
      return res.status(400).json({ error: 'newRecommendation is required and must be a string.' });
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'A non-empty reason is mandatory to override recommendation.' });
    }

    const report = await reportService.overrideRecommendation(sessionId, {
      newRecommendation,
      reason,
      remarks,
      overriddenBy,
    });

    return res.status(200).json(report);
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      error: error.message || 'Failed to override recommendation.',
    });
  }
});

/**
 * POST /api/interviews/:sessionId/report/remarks
 * Appends or updates assessment board remarks on a report snapshot.
 * Body: { remarks: string }
 */
router.post('/interviews/:sessionId/report/remarks', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { remarks } = req.body || {};

    if (remarks === undefined || remarks === null || typeof remarks !== 'string') {
      return res.status(400).json({ error: 'remarks is required and must be a string.' });
    }

    const report = await reportService.addBoardRemarks(sessionId, remarks);
    return res.status(200).json(report);
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      error: error.message || 'Failed to record board remarks.',
    });
  }
});

/**
 * GET /api/reports
 * Lists report summaries for candidate ranking view.
 * Query params: ?postId=...&recommendation=...
 */
router.get('/reports', async (req, res) => {
  try {
    const { postId, recommendation, skip, take } = req.query;

    const result = await reportService.listReports({
      postId,
      recommendation,
      skip,
      take,
    });

    return res.status(200).json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      error: error.message || 'Failed to list reports.',
    });
  }
});

module.exports = router;

