/**
 * @file answerScoringService.js
 * @description Service layer for evaluating candidate interview answers and persisting
 * explainable scores via the Part 1 Response model.
 */

const prisma = require('../db/prismaClient');
const questionService = require('./questionService');
const sessionService = require('./sessionService');
const activeScorer = require('../scorers');
const { VERDICTS, FLAGS } = require('../config/scorerConfig');

/**
 * Helper to persist a response through Part 1's addResponse() while translating
 * Prisma's unique constraint violation (P2002) into a clear conflict error.
 *
 * @async
 * @param {string} sessionId - Interview session ID.
 * @param {string} questionId - Question ID.
 * @param {string} answerText - Candidate response text.
 * @param {number|null} relevancy - Relevancy score or null.
 * @param {number|null} correctness - Correctness score or null.
 * @param {{ answerScore: number|null, verdict: string, breakdown: object }} scoringMeta - Extended scoring fields.
 * @returns {Promise<object>} Saved Response record.
 */
async function saveResponseWithConflictHandling(
  sessionId,
  questionId,
  answerText,
  relevancy,
  correctness,
  scoringMeta
) {
  try {
    return await sessionService.addResponse(
      sessionId,
      questionId,
      answerText,
      relevancy,
      correctness,
      scoringMeta
    );
  } catch (err) {
    if (err.code === 'P2002' || (err.message && err.message.includes('Unique constraint failed'))) {
      const conflictError = new Error(
        `Question "${questionId}" has already been answered in session "${sessionId}".`
      );
      conflictError.code = 'P2002';
      conflictError.statusCode = 409;
      throw conflictError;
    }
    throw err;
  }
}

/**
 * Fetches the target question, scores the candidate's answer using the active configured scorer
 * (skipping scoring for ICEBREAKER questions without an idealAnswer), saves the response using
 * Part 1's addResponse(), and returns the complete explainable scoring result.
 *
 * Rejects duplicate submissions for the same (sessionId, questionId) via the DB unique constraint.
 *
 * @async
 * @param {string} sessionId - Unique identifier of the interview session.
 * @param {string} questionId - Unique identifier of the interview question.
 * @param {string} answerText - Candidate's free-text answer (may be empty).
 * @param {object} [scorer=activeScorer] - Optional swappable scorer override.
 * @returns {Promise<{
 *   responseId: string,
 *   sessionId: string,
 *   questionId: string,
 *   relevancy: number|null,
 *   correctness: number|null,
 *   answerScore: number|null,
 *   verdict: string,
 *   breakdown: object
 * }>} Saved response ID and full scoring result.
 */
async function scoreAndSaveResponse(sessionId, questionId, answerText, scorer = activeScorer) {
  if (!sessionId || typeof sessionId !== 'string') {
    const err = new Error('sessionId is required and must be a non-empty string.');
    err.statusCode = 400;
    throw err;
  }

  if (!questionId || typeof questionId !== 'string') {
    const err = new Error('questionId is required and must be a non-empty string.');
    err.statusCode = 400;
    throw err;
  }

  if (typeof answerText !== 'string') {
    const err = new Error('answerText is required and must be a string.');
    err.statusCode = 400;
    throw err;
  }

  // Verify session exists
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!session) {
    const err = new Error(`Session with ID "${sessionId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  // Fetch question from Part 1 service
  const question = await questionService.getQuestionById(questionId);
  if (!question) {
    const err = new Error(`Question with ID "${questionId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  // Skip scoring for ICEBREAKER questions that have no idealAnswer
  const isUnscoredIcebreaker =
    question.levelTag === 'ICEBREAKER' &&
    (!question.idealAnswer || question.idealAnswer.trim().length === 0);

  if (isUnscoredIcebreaker) {
    const notScoredBreakdown = {
      matchedKeywords: [],
      partialKeywords: [],
      missingKeywords: [],
      keywordCoverage: null,
      idealAnswerSimilarity: null,
      questionSimilarity: null,
      topicOverlap: null,
      flags: [FLAGS.NOT_SCORED],
      reason: 'ICEBREAKER question without idealAnswer is stored without scoring.',
    };

    const saved = await saveResponseWithConflictHandling(
      sessionId,
      questionId,
      answerText,
      null,
      null,
      {
        answerScore: null,
        verdict: VERDICTS.NOT_SCORED,
        breakdown: notScoredBreakdown,
      }
    );

    return {
      responseId: saved.id,
      sessionId,
      questionId,
      relevancy: null,
      correctness: null,
      answerScore: null,
      verdict: VERDICTS.NOT_SCORED,
      breakdown: notScoredBreakdown,
    };
  }

  // Ensure IDF cache is populated before scoring
  if (typeof scorer.ensureIdfLoaded === 'function') {
    await scorer.ensureIdfLoaded();
  }

  // Run active scorer
  const scoringResult = await scorer.scoreAnswer({ question, answerText });

  // Persist using Part 1 addResponse()
  const saved = await saveResponseWithConflictHandling(
    sessionId,
    questionId,
    answerText,
    scoringResult.relevancy,
    scoringResult.correctness,
    {
      answerScore: scoringResult.answerScore,
      verdict: scoringResult.verdict,
      breakdown: scoringResult.breakdown,
    }
  );

  return {
    responseId: saved.id,
    sessionId,
    questionId,
    relevancy: scoringResult.relevancy,
    correctness: scoringResult.correctness,
    answerScore: scoringResult.answerScore,
    verdict: scoringResult.verdict,
    breakdown: scoringResult.breakdown,
  };
}

module.exports = {
  scoreAndSaveResponse,
};

