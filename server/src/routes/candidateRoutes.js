/**
 * @file candidateRoutes.js
 * @description Express router exposing endpoints for candidate profile creation and retrieval.
 */

const express = require('express');
const prisma = require('../db/prismaClient');
const sessionService = require('../services/sessionService');

const router = express.Router();

/**
 * GET /api/candidates
 * Retrieves all registered candidates along with their associated skills.
 */
router.get('/candidates', async (req, res) => {
  try {
    const candidates = await prisma.candidate.findMany({
      include: {
        skills: {
          select: { skillName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = candidates.map((c) => ({
      ...c,
      skills: c.skills.map((s) => s.skillName),
    }));

    return res.status(200).json(formatted);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to retrieve candidates.',
      details: error.message,
    });
  }
});

/**
 * POST /api/candidates
 * Registers a new candidate profile.
 * Body: { name: string, postApplied: string, experienceLevel: string }
 */
router.post('/candidates', async (req, res) => {
  try {
    const { name, postApplied, experienceLevel } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Candidate name is required.' });
    }

    if (!postApplied || typeof postApplied !== 'string' || !postApplied.trim()) {
      return res.status(400).json({ error: 'Post applied for is required.' });
    }

    if (!experienceLevel || typeof experienceLevel !== 'string' || !experienceLevel.trim()) {
      return res.status(400).json({ error: 'Experience level is required.' });
    }

    const candidate = await sessionService.createCandidate(
      name.trim(),
      postApplied.trim(),
      experienceLevel.trim()
    );

    return res.status(201).json(candidate);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to create candidate.',
      details: error.message,
    });
  }
});

/**
 * GET /api/candidates/:id
 * Retrieves a single candidate profile including their declared skills and interview history.
 */
router.get('/candidates/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Candidate ID is required.' });
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        skills: {
          select: { skillName: true },
        },
        sessions: {
          orderBy: { startTime: 'desc' },
        },
        skillMatchResults: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!candidate) {
      return res.status(404).json({ error: `Candidate with ID "${id}" not found.` });
    }

    const formatted = {
      ...candidate,
      skills: candidate.skills.map((s) => s.skillName),
    };

    return res.status(200).json(formatted);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to retrieve candidate profile.',
      details: error.message,
    });
  }
});

module.exports = router;

