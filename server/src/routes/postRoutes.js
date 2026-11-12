/**
 * @file postRoutes.js
 * @description Express router exposing endpoints for retrieving recruitment posts and required skills.
 */

const express = require('express');
const prisma = require('../db/prismaClient');

const router = express.Router();

/**
 * GET /api/posts
 * Retrieves all recruitment posts along with their associated skills and subject domain.
 */
router.get('/posts', async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
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

