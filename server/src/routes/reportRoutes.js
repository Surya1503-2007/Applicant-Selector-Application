/**
 * @file reportRoutes.js
 * @description Express router for dossier generation, board remarks, overrides, and recruitment rankings.
 */

const express = require('express');
const {
  generateReport,
  saveBoardRemarks,
  overrideRecommendation,
  regenerateReport,
  getAllRankings,
} = require('../services/reportService');

const router = express.Router();

/**
 * GET /api/reports
 * Retrieves all evaluated candidate dossiers for the Rankings table.
 */
router.get('/reports', async (req, res) => {
  try {
    const rankings = await getAllRankings();
    return res.status(200).json(rankings);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to retrieve recruitment rankings.',
      details: error.message,
    });
  }
});

/**
 * GET /api/reports/:sessionId
 * Generates and returns the complete candidate evaluation dossier for an interview session.
 */
router.get('/reports/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' });
    }

    const report = await generateReport(sessionId);
    return res.status(200).json(report);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to generate assessment report.',
      details: error.message,
    });
  }
});

/**
 * POST /api/reports/:sessionId/remarks
 * Saves presiding board remarks for a candidate dossier.
 * Body: { remarks: string }
 */
router.post('/reports/:sessionId/remarks', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { remarks } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' });
    }

    const result = await saveBoardRemarks(sessionId, remarks);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to save board remarks.',
      details: error.message,
    });
  }
});

/**
 * POST /api/reports/:sessionId/override
 * Overrides the automated system recommendation with examiner rationale.
 * Body: { finalRecommendation: string, reason: string, overriddenBy: string }
 */
router.post('/reports/:sessionId/override', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { finalRecommendation, reason, overriddenBy } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' });
    }
    if (!finalRecommendation) {
      return res.status(400).json({ error: 'finalRecommendation is required.' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Override justification reason is mandatory.' });
    }

    const result = await overrideRecommendation(sessionId, {
      finalRecommendation,
      reason,
      overriddenBy,
    });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to record recommendation override.',
      details: error.message,
    });
  }
});

/**
 * POST /api/reports/:sessionId/regenerate
 * Recalculates the report and increments the report version while retaining previous records.
 */
router.post('/reports/:sessionId/regenerate', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' });
    }

    const updatedReport = await regenerateReport(sessionId);
    return res.status(200).json(updatedReport);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to regenerate assessment report.',
      details: error.message,
    });
  }
});

module.exports = router;

