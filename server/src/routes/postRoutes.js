/**
 * @file postRoutes.js
 * @description Express router exposing endpoints for recruitment posts, required skills,
 * and subject domains for Part 7D multi-subject administration.
 */

const express = require('express');
const prisma = require('../db/prismaClient');
const SUBJECT_CONFIG = require('../config/subjectConfig');

const router = express.Router();

/**
 * GET /api/subjects
 * Retrieves all registered subject domains along with topic counts and total question counts.
 */
router.get('/subjects', async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      include: {
        topics: {
          select: {
            id: true,
            name: true,
            _count: { select: { questions: true } },
          },
        },
        _count: {
          select: { posts: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const enriched = await Promise.all(
      subjects.map(async (subj) => {
        const topicIds = subj.topics.map((t) => t.id);
        const questionCount = await prisma.question.count({
          where: { topicId: { in: topicIds } },
        });

        return {
          id: subj.id,
          name: subj.name,
          createdAt: subj.createdAt,
          topicCount: subj.topics.length,
          postCount: subj._count.posts,
          questionCount,
          topics: subj.topics.map((t) => ({
            id: t.id,
            name: t.name,
            questionCount: t._count.questions,
          })),
        };
      })
    );

    return res.status(200).json(enriched);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to retrieve subjects.',
      details: error.message,
    });
  }
});

/**
 * GET /api/subjects/:id/stats
 * Detailed admin breakdown of a subject's topics and question distribution by difficulty,
 * including warnings when a topic has fewer than configured minimum questions per difficulty.
 */
router.get('/subjects/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        topics: {
          include: {
            questions: {
              where: { status: 'ACTIVE' },
              select: { id: true, difficulty: true, levelTag: true },
            },
          },
          orderBy: { name: 'asc' },
        },
        posts: {
          select: { id: true, title: true, level: true },
        },
      },
    });

    if (!subject) {
      return res.status(404).json({ error: `Subject "${id}" not found.` });
    }

    const minPerDiff = SUBJECT_CONFIG.MIN_QUESTIONS_PER_DIFFICULTY;

    const topicStats = subject.topics.map((topic) => {
      const counts = { EASY: 0, MEDIUM: 0, HARD: 0, total: 0 };
      for (const q of topic.questions) {
        if (counts[q.difficulty] !== undefined) {
          counts[q.difficulty]++;
          counts.total++;
        }
      }

      const warnings = [];
      for (const diff of ['EASY', 'MEDIUM', 'HARD']) {
        if (counts[diff] < minPerDiff[diff]) {
          warnings.push({
            difficulty: diff,
            current: counts[diff],
            required: minPerDiff[diff],
            message: `Topic "${topic.name}" has ${counts[diff]} ${diff} question(s); minimum required is ${minPerDiff[diff]}.`,
          });
        }
      }

      return {
        id: topic.id,
        name: topic.name,
        counts,
        hasDeficit: warnings.length > 0,
        warnings,
      };
    });

    const totalQuestions = topicStats.reduce((sum, t) => sum + t.counts.total, 0);
    const overallDeficits = topicStats.flatMap((t) => t.warnings);

    return res.status(200).json({
      subject: {
        id: subject.id,
        name: subject.name,
        createdAt: subject.createdAt,
      },
      topicCount: topicStats.length,
      totalQuestions,
      posts: subject.posts,
      topics: topicStats,
      hasDeficits: overallDeficits.length > 0,
      deficitCount: overallDeficits.length,
      warnings: overallDeficits,
      configSnapshot: minPerDiff,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to retrieve subject statistics.',
      details: error.message,
    });
  }
});

/**
 * POST /api/subjects
 * Creates a new subject domain (e.g., via Admin tooling).
 */
router.post('/subjects', async (req, res) => {
  try {
    const { name, id } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Subject name is required.' });
    }

    const trimmedName = name.trim();
    const existing = await prisma.subject.findUnique({
      where: { name: trimmedName },
    });
    if (existing) {
      return res.status(400).json({ error: `Subject with name "${trimmedName}" already exists.` });
    }

    const subject = await prisma.subject.create({
      data: {
        id: id && typeof id === 'string' ? id.trim() : undefined,
        name: trimmedName,
      },
    });

    return res.status(201).json(subject);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to create subject.',
      details: error.message,
    });
  }
});

/**
 * GET /api/posts
 * Retrieves all recruitment posts along with their associated skills and subject domain.
 */
router.get('/posts', async (req, res) => {
  try {
    const { subjectId } = req.query;
    const where = {};
    if (subjectId) where.subjectId = subjectId;

    const posts = await prisma.post.findMany({
      where,
      include: {
        postSkills: {
          orderBy: [{ isMandatory: 'desc' }, { weight: 'desc' }],
        },
        subject: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.status(200).json(posts);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to retrieve job posts.',
      details: error.message,
    });
  }
});

/**
 * POST /api/posts
 * Creates a new recruitment post associated with a chosen subject, with required skills.
 */
router.post('/posts', async (req, res) => {
  try {
    const { id, title, subjectId, level = "Scientist 'C'", skills = [] } = req.body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Post title is required.' });
    }
    if (!subjectId || typeof subjectId !== 'string' || !subjectId.trim()) {
      return res.status(400).json({ error: 'subjectId is required when creating a post.' });
    }

    // Verify subject exists
    const subject = await prisma.subject.findUnique({ where: { id: subjectId.trim() } });
    if (!subject) {
      return res.status(404).json({ error: `Subject with ID "${subjectId}" not found.` });
    }

    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({ error: 'At least one required post skill is necessary.' });
    }

    const post = await prisma.$transaction(async (tx) => {
      const createdPost = await tx.post.create({
        data: {
          id: id && typeof id === 'string' ? id.trim() : undefined,
          title: title.trim(),
          subjectId: subjectId.trim(),
          level: String(level).trim(),
        },
      });

      for (const skill of skills) {
        if (!skill.skillName || typeof skill.skillName !== 'string') continue;
        await tx.postSkill.create({
          data: {
            postId: createdPost.id,
            skillName: skill.skillName.trim(),
            weight: typeof skill.weight === 'number' ? Math.max(1, Math.min(5, skill.weight)) : 3,
            isMandatory: Boolean(skill.isMandatory),
          },
        });
      }

      return tx.post.findUnique({
        where: { id: createdPost.id },
        include: {
          subject: true,
          postSkills: {
            orderBy: [{ isMandatory: 'desc' }, { weight: 'desc' }],
          },
        },
      });
    });

    return res.status(201).json(post);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to create post.',
      details: error.message,
    });
  }
});

/**
 * GET /api/posts/:id
 * Retrieves a single recruitment post by ID, including its required skills and subject details.
 */
router.get('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Post ID is required.' });
    }

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        postSkills: {
          orderBy: [{ isMandatory: 'desc' }, { weight: 'desc' }],
        },
        subject: true,
      },
    });

    if (!post) {
      return res.status(404).json({ error: `Post with ID "${id}" not found.` });
    }

    return res.status(200).json(post);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to retrieve post details.',
      details: error.message,
    });
  }
});

module.exports = router;
