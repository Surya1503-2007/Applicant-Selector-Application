/**
 * @file sessionRoutes.js
 * @description Express router exposing endpoints for interview session lifecycle and dashboard retrieval.
 */

const express = require('express');
const prisma = require('../db/prismaClient');
const sessionService = require('../services/sessionService');

const router = express.Router();

/**
 * GET /api/sessions
 * Retrieves recent interview sessions for the examiner dashboard.
 */
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            postApplied: true,
            experienceLevel: true,
          },
        },
        responses: {
          select: {
            id: true,
            relevancyScore: true,
            correctnessScore: true,
            answerScore: true,
            verdict: true,
          },
        },
      },
      orderBy: { startTime: 'desc' },
      take: 50,
    });

    const formatted = sessions.map((s) => ({
      id: s.id,
      candidateId: s.candidateId,
      candidateName: s.candidate?.name || 'Unknown Candidate',
      postApplied: s.candidate?.postApplied || 'N/A',
      experienceLevel: s.candidate?.experienceLevel || 'N/A',
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.endTime ? 'COMPLETED' : 'ACTIVE',
      totalAnswered: s.responses?.length || 0,
      createdAt: s.createdAt,
    }));

    return res.status(200).json(formatted);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to retrieve interview sessions.',
      details: error.message,
    });
  }
});

/**
 * POST /api/sessions
 * Initializes a new interview session for a candidate.
 * Body: { candidateId: string }
 */
router.post('/sessions', async (req, res) => {
  try {
    const { candidateId } = req.body || {};

    if (!candidateId || typeof candidateId !== 'string') {
      return res.status(400).json({ error: 'candidateId is required and must be a string.' });
    }

    const session = await sessionService.createSession(candidateId);
    return res.status(201).json(session);
  } catch (error) {
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: 'Failed to create interview session.',
      details: error.message,
    });
  }
});

/**
 * GET /api/sessions/:id
 * Retrieves detailed session information including candidate profile and responses.
 */
router.get('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Session ID is required.' });
    }

    const session = await sessionService.getSessionById(id);

    if (!session) {
      return res.status(404).json({ error: `Session with ID "${id}" not found.` });
    }

    const formatted = {
      ...session,
      status: session.endTime ? 'COMPLETED' : 'ACTIVE',
    };

    return res.status(200).json(formatted);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to retrieve interview session.',
      details: error.message,
    });
  }
});

module.exports = router;

