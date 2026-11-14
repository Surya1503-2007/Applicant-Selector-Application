/**
 * @file questionRoutes.js
 * @description Express router for question bank management, expert question injection,
 * and live relevancy preview (Part 7C).
 */

const express = require('express');
const prisma = require('../db/prismaClient');
const { scoreQuestionRelevancy, determineRelevancyBand } = require('../reports/questionRelevancy');

const router = express.Router();

/**
 * GET /api/questions
 * Lists questions from the bank, filterable by topicId, difficulty, levelTag, status, source.
 */
router.get('/questions', async (req, res) => {
  try {
    const { topicId, difficulty, levelTag, status, source } = req.query;

    const where = {};
    if (topicId) where.topicId = topicId;
    if (difficulty) where.difficulty = difficulty;
    if (levelTag) where.levelTag = levelTag;
    if (status) {
      where.status = status;
    } else {
      // Default to ACTIVE questions unless specified
      where.status = 'ACTIVE';
    }
    if (source) where.source = source;

    const questions = await prisma.question.findMany({
      where,
      include: {
        topic: { select: { id: true, name: true, subjectId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json(questions);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to retrieve questions.',
      details: error.message,
    });
  }
});

/**
 * POST /api/questions
 * Creates a new question in the question bank.
 * Validation: scorable questions (TECHNICAL / MANAGERIAL or non-empty idealAnswer) require idealAnswer and keywords.
 */
router.post('/questions', async (req, res) => {
  try {
    const {
      topicId,
      difficulty = 'MEDIUM',
      questionText,
      simplifiedText,
      idealAnswer,
      keywords = [],
      levelTag = 'TECHNICAL',
      source = 'BANK',
      createdById,
      aspectKeywords = [],
    } = req.body || {};

    if (!questionText || typeof questionText !== 'string' || !questionText.trim()) {
      return res.status(400).json({ error: 'questionText is required.' });
    }

    // Validation for scorable questions
    const isIcebreaker = levelTag === 'ICEBREAKER';
    if (!isIcebreaker) {
      if (!idealAnswer || typeof idealAnswer !== 'string' || !idealAnswer.trim()) {
        return res.status(400).json({
          error: 'idealAnswer is required for scorable questions.',
        });
      }
      if (!Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({
          error: 'keywords array with at least one keyword is required for scorable questions.',
        });
      }
    }

    const question = await prisma.question.create({
      data: {
        topicId: topicId || null,
        difficulty,
        questionText: questionText.trim(),
        simplifiedText: simplifiedText ? simplifiedText.trim() : null,
        idealAnswer: idealAnswer ? idealAnswer.trim() : '',
        keywords: Array.isArray(keywords) ? keywords.map((k) => String(k).trim()).filter(Boolean) : [],
        levelTag,
        source: source === 'EXPERT' ? 'EXPERT' : 'BANK',
        createdById: createdById || null,
        status: 'ACTIVE',
        aspectKeywords: Array.isArray(aspectKeywords)
          ? aspectKeywords.map((a) => String(a).trim()).filter(Boolean)
          : [],
      },
      include: {
        topic: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json(question);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to create question.',
      details: error.message,
    });
  }
});

/**
 * PUT /api/questions/:id
 * Updates an existing question in the bank.
 */
router.put('/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.question.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: `Question "${id}" not found.` });
    }

    const {
      topicId,
      difficulty,
      questionText,
      simplifiedText,
      idealAnswer,
      keywords,
      levelTag,
      aspectKeywords,
      status,
    } = req.body || {};

    const data = {};
    if (topicId !== undefined) data.topicId = topicId || null;
    if (difficulty) data.difficulty = difficulty;
    if (questionText) data.questionText = questionText.trim();
    if (simplifiedText !== undefined) data.simplifiedText = simplifiedText ? simplifiedText.trim() : null;
    if (idealAnswer !== undefined) data.idealAnswer = idealAnswer.trim();
    if (Array.isArray(keywords)) {
      data.keywords = keywords.map((k) => String(k).trim()).filter(Boolean);
    }
    if (levelTag) data.levelTag = levelTag;
    if (Array.isArray(aspectKeywords)) {
      data.aspectKeywords = aspectKeywords.map((a) => String(a).trim()).filter(Boolean);
    }
    if (status) data.status = status;

    const updated = await prisma.question.update({
      where: { id },
      data,
      include: { topic: { select: { id: true, name: true } } },
    });

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to update question.',
      details: error.message,
    });
  }
});

/**
 * POST /api/questions/:id/archive
 * Archives a question. Scannable questions with existing responses are never hard-deleted;
 * archiving preserves historical integrity.
 */
router.post('/questions/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.question.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: `Question "${id}" not found.` });
    }

    const updated = await prisma.question.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    return res.status(200).json({
      message: `Question "${id}" has been archived.`,
      question: updated,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to archive question.',
      details: error.message,
    });
  }
});

/**
 * POST /api/questions/relevancy-preview
 * Previews the relevancy of a proposed or existing question against candidate skills & post requirements.
 * Body: { questionText, keywords: string[], topicId?, candidateId?, postId? }
 */
router.post('/questions/relevancy-preview', async (req, res) => {
  try {
    const { questionText, keywords = [], topicId, candidateId, postId } = req.body || {};

    let topicName = '';
    if (topicId) {
      const topic = await prisma.topic.findUnique({ where: { id: topicId } });
      if (topic) topicName = topic.name;
    }

    let candidateSkills = [];
    if (candidateId) {
      const skills = await prisma.candidateSkill.findMany({
        where: { candidateId },
        select: { skillName: true },
      });
      candidateSkills = skills.map((s) => s.skillName);
    }

    let postSkills = [];
    if (postId) {
      const pSkills = await prisma.postSkill.findMany({
        where: { postId },
        select: { skillName: true, weight: true },
      });
      postSkills = pSkills;
    }

    const relevancyResult = scoreQuestionRelevancy({
      question: {
        questionText,
        keywords: Array.isArray(keywords) ? keywords : [],
        topicName,
      },
      candidateSkills,
      postSkills,
    });

    const scorePercent = Math.round(relevancyResult.questionRelevancy * 100 * 100) / 100;
    const band = determineRelevancyBand(scorePercent);

    return res.status(200).json({
      score: scorePercent,
      band,
      isLowFit: relevancyResult.isLowFit,
      candidateFit: relevancyResult.candidateFit,
      postFit: relevancyResult.postFit,
      breakdown: relevancyResult.breakdown,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to calculate relevancy preview.',
      details: error.message,
    });
  }
});

module.exports = router;

