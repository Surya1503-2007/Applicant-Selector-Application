/**
 * @file questionService.js
 * @description Data-access service for querying and managing interview questions.
 * Handles question retrieval by topic and difficulty, follow-up resolution, and candidate question exclusion.
 */

const prisma = require('../db/prismaClient');

/**
 * Retrieves all questions matching the given topic and difficulty.
 *
 * @async
 * @param {string|null} [topicId=null] - Unique identifier of the topic (or null for topic-agnostic/icebreaker questions).
 * @param {('EASY'|'MEDIUM'|'HARD')} [difficulty] - Target difficulty level.
 * @returns {Promise<Array<object>>} List of matching questions.
 */
async function getQuestions(topicId, difficulty) {
  const where = {};

  if (topicId !== undefined && topicId !== null) {
    where.topicId = topicId;
  }

  if (difficulty) {
    where.difficulty = difficulty;
  }

  return prisma.question.findMany({
    where,
    include: {
      topic: {
        select: { id: true, name: true, subjectId: true },
      },
      followUps: {
        select: { id: true, difficulty: true, questionText: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Retrieves the next available question for a topic and difficulty,
 * excluding questions that have already been asked in the current session.
 *
 * @async
 * @param {string|null} topicId - Unique identifier of the topic (or null for icebreakers).
 * @param {('EASY'|'MEDIUM'|'HARD')} difficulty - Target difficulty level.
 * @param {string[]} [excludeIds=[]] - Array of question IDs already asked to avoid repetition.
 * @returns {Promise<object|null>} The selected question, or null if no unasked questions remain.
 */
async function getNextQuestion(topicId, difficulty, excludeIds = []) {
  const where = {
    difficulty,
  };

  if (topicId !== undefined && topicId !== null) {
    where.topicId = topicId;
  }

  if (Array.isArray(excludeIds) && excludeIds.length > 0) {
    where.id = {
      notIn: excludeIds,
    };
  }

  // Retrieve the first eligible candidate question
  // TODO [Part 2]: Implement adaptive weighting and candidate domain performance prioritization
  const question = await prisma.question.findFirst({
    where,
    include: {
      topic: {
        select: { id: true, name: true },
      },
      followUps: true,
    },
    orderBy: { id: 'asc' },
  });

  return question;
}

/**
 * Retrieves all direct follow-up questions linked to a specific parent question.
 * Used when a candidate's answer unlocks deeper inquiry into the same thread.
 *
 * @async
 * @param {string} parentQId - Unique identifier of the parent question.
 * @returns {Promise<Array<object>>} List of follow-up questions.
 */
async function getFollowupQuestions(parentQId) {
  if (!parentQId) {
    return [];
  }

  return prisma.question.findMany({
    where: {
      parentQId,
    },
    include: {
      topic: {
        select: { id: true, name: true },
      },
    },
    orderBy: { difficulty: 'asc' },
  });
}

/**
 * Retrieves a single question by its unique ID.
 *
 * @async
 * @param {string} id - Question ID.
 * @returns {Promise<object|null>} The question record with relations, or null if not found.
 */
async function getQuestionById(id) {
  return prisma.question.findUnique({
    where: { id },
    include: {
      topic: true,
      parentQuestion: true,
      followUps: true,
    },
  });
}

/**
 * Retrieves icebreaker questions for beginning an interview session.
 *
 * @async
 * @param {string[]} [excludeIds=[]] - Array of question IDs already asked.
 * @returns {Promise<Array<object>>} List of icebreaker questions.
 */
async function getIcebreakerQuestions(excludeIds = []) {
  const where = {
    levelTag: 'ICEBREAKER',
  };

  if (Array.isArray(excludeIds) && excludeIds.length > 0) {
    where.id = { notIn: excludeIds };
  }

  return prisma.question.findMany({
    where,
    orderBy: { id: 'asc' },
  });
}

// TODO [Part 2]: Implement calculateDifficultyTransition(previousRelevancyScore, previousDifficulty)
// TODO [Part 2]: Implement keywordExtractionAndCoverage(candidateAnswer, idealAnswerKeywords)

module.exports = {
  getQuestions,
  getNextQuestion,
  getFollowupQuestions,
  getQuestionById,
  getIcebreakerQuestions,
};

