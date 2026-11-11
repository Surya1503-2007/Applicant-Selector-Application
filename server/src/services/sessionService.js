/**
 * @file sessionService.js
 * @description Data-access service for interview sessions, candidate management, and response tracking.
 * Provides functions to initiate sessions, record responses, and retrieve asked question histories.
 */

const prisma = require('../db/prismaClient');

/**
 * Creates a new candidate profile in the system.
 *
 * @async
 * @param {string} name - Candidate full name.
 * @param {string} postApplied - Post applied for (e.g., "Scientist 'B' - ASD").
 * @param {string} experienceLevel - Experience tier (e.g., "Junior", "Mid-Level", "Senior").
 * @returns {Promise<object>} Created candidate record.
 */
async function createCandidate(name, postApplied, experienceLevel) {
  return prisma.candidate.create({
    data: {
      name,
      postApplied,
      experienceLevel,
    },
  });
}

/**
 * Creates and initializes a new interview session for a candidate.
 *
 * @async
 * @param {string} candidateId - Unique identifier of the candidate.
 * @returns {Promise<object>} Created session record with startTime set.
 */
async function createSession(candidateId) {
  if (!candidateId) {
    throw new Error('candidateId is required to create an interview session.');
  }

  return prisma.session.create({
    data: {
      candidateId,
      startTime: new Date(),
      endTime: null,
    },
    include: {
      candidate: true,
    },
  });
}

/**
 * Concludes an ongoing interview session by setting its endTime.
 *
 * @async
 * @param {string} sessionId - Unique identifier of the session to conclude.
 * @returns {Promise<object>} Updated session record.
 */
async function endSession(sessionId) {
  if (!sessionId) {
    throw new Error('sessionId is required to end an interview session.');
  }

  return prisma.session.update({
    where: { id: sessionId },
    data: {
      endTime: new Date(),
    },
  });
}

/**
 * Records a candidate's response to an interview question within a session.
 * Enforces database-level uniqueness to prevent duplicate answers for the same question in a session.
 *
 * @async
 * @param {string} sessionId - Unique identifier of the interview session.
 * @param {string} questionId - Unique identifier of the question answered.
 * @param {string} answerText - The raw transcript/text response provided by the candidate.
 * @param {number|null} [relevancy=null] - Evaluated relevancy score (0.0 to 1.0 or null if not yet scored).
 * @param {number|null} [correctness=null] - Evaluated correctness score (0.0 to 1.0 or null if not yet scored).
 * @param {{ answerScore?: number|null, verdict?: string|null, breakdown?: object|null }} [scoringMeta={}] - Optional Part 3 scoring metadata.
 * @returns {Promise<object>} Created response record.
 */
async function addResponse(
  sessionId,
  questionId,
  answerText,
  relevancy = null,
  correctness = null,
  scoringMeta = {}
) {
  if (!sessionId || !questionId) {
    throw new Error('Both sessionId and questionId are required to record a response.');
  }

  const { answerScore = null, verdict = null, breakdown = null } = scoringMeta || {};

  return prisma.response.create({
    data: {
      sessionId,
      questionId,
      answerText,
      relevancyScore: relevancy !== undefined ? relevancy : null,
      correctnessScore: correctness !== undefined ? correctness : null,
      answerScore: answerScore !== undefined ? answerScore : null,
      verdict: verdict !== undefined ? verdict : null,
      breakdown: breakdown !== undefined && breakdown !== null ? breakdown : undefined,
      timestamp: new Date(),
    },
    include: {
      question: {
        select: {
          id: true,
          difficulty: true,
          levelTag: true,
          topicId: true,
        },
      },
    },
  });
}

/**
 * Retrieves the list of all question IDs that have been asked and answered in a session.
 * Used to filter out duplicate questions during adaptive question selection.
 *
 * @async
 * @param {string} sessionId - Unique identifier of the session.
 * @returns {Promise<string[]>} Array of question ID strings.
 */
async function getAskedQuestionIds(sessionId) {
  if (!sessionId) {
    throw new Error('sessionId is required to fetch asked questions.');
  }

  const responses = await prisma.response.findMany({
    where: { sessionId },
    select: { questionId: true },
  });

  return responses.map((r) => r.questionId);
}

/**
 * Retrieves full session details including candidate information and response history.
 *
 * @async
 * @param {string} sessionId - Unique identifier of the session.
 * @returns {Promise<object|null>} Session record with candidate and responses.
 */
async function getSessionById(sessionId) {
  return prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      candidate: true,
      responses: {
        include: {
          question: true,
        },
        orderBy: { timestamp: 'asc' },
      },
    },
  });
}

// TODO [Part 2]: Implement calculateSessionAggregateScore(sessionId)
// TODO [Part 3]: Implement generateSessionDebriefReport(sessionId)

module.exports = {
  createCandidate,
  createSession,
  endSession,
  addResponse,
  getAskedQuestionIds,
  getSessionById,
};

