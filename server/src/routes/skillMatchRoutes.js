/**
 * @file skillMatchRoutes.js
 * @description Express router exposing endpoints for skill match computation and candidate skill ingestion.
 */

const express = require('express');
const { computeSkillMatch, addCandidateSkills, getLatestSkillMatch } = require('../services/skillMatchService');

const router = express.Router();

/**
 * POST /api/skill-match
 * Computes and returns the skill-match suitability score and explainable breakdown for a candidate and post.
 * Body: { candidateId: string, postId: string }
 */
router.post('/skill-match', async (req, res) => {
  try {
    const { candidateId, postId } = req.body;

    if (!candidateId || typeof candidateId !== 'string') {
      return res.status(400).json({
        error: 'Invalid or missing candidateId. Must be a non-empty string.',
      });
    }

    if (!postId || typeof postId !== 'string') {
      return res.status(400).json({
        error: 'Invalid or missing postId. Must be a non-empty string.',
      });
    }

    const result = await computeSkillMatch(candidateId, postId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: 'Failed to compute skill match.',
      details: error.message,
    });
  }
});

/**
 * POST /api/candidates/:id/skills
 * Ingests an array of skills for a candidate profile.
 * Params: id (candidateId)
 * Body: { skills: string[] }
 */
router.post('/candidates/:id/skills', async (req, res) => {
  try {
    const candidateId = req.params.id;
    const { skills } = req.body;

    if (!candidateId) {
      return res.status(400).json({ error: 'Candidate ID parameter is required.' });
    }

    if (!Array.isArray(skills)) {
      return res.status(400).json({
        error: 'Invalid skills payload. "skills" must be an array of strings.',
      });
    }

    const savedSkills = await addCandidateSkills(candidateId, skills);

    return res.status(201).json({
      success: true,
      candidateId,
      count: savedSkills.length,
      skills: savedSkills.map((s) => s.skillName),
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to save candidate skills.',
      details: error.message,
    });
  }
});

/**
 * GET /api/candidates/:id/skills-match/:postId
 * Retrieves the latest persisted skill match result for a candidate and post.
 */
router.get('/candidates/:id/skills-match/:postId', async (req, res) => {
  try {
    const { id: candidateId, postId } = req.params;
    const latest = await getLatestSkillMatch(candidateId, postId);

    if (!latest) {
      return res.status(404).json({
        error: `No skill match record found for candidate ${candidateId} and post ${postId}.`,
      });
    }

    return res.status(200).json(latest);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to retrieve skill match result.',
      details: error.message,
    });
  }
});

module.exports = router;

