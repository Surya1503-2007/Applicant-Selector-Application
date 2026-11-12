/**
 * @file adaptiveEngineService.js
 * @description Adaptive Interview Engine (Part 4) service for RAC DRDO.
 * Manages question sequencing, refresh-safe pending questions, difficulty progression,
 * plain-English decision reasoning, and early session termination.
 */

const prisma = require('../db/prismaClient');
const path = require('path');
const fs = require('fs');

// In-memory registry for session state, active questions, and audit logs
const sessionActiveQuestions = new Map();
const sessionAuditLogs = new Map();
const sessionTerminations = new Map();

/**
 * Loads ASD question bank seed as fallback
 */
function loadAsdQuestions() {
  try {
    const filePath = path.join(__dirname, '..', '..', 'prisma', 'seedData', 'asd.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    // ignore
  }
  return { questions: [], icebreakers: [] };
}

/**
 * Helper to determine difficulty escalation/step-down
 * @param {'EASY'|'MEDIUM'|'HARD'} currentDiff
 * @param {'STRONG'|'PARTIAL'|'IRRELEVANT'|'NOT_SCORED'} verdict
 * @returns {{ nextDiff: 'EASY'|'MEDIUM'|'HARD', action: string, reason: string }}
 */
function calculateDifficultyTransition(currentDiff, verdict, topicName) {
  if (verdict === 'STRONG') {
    if (currentDiff === 'EASY') {
      return {
        nextDiff: 'MEDIUM',
        action: 'ADVANCE_DIFFICULTY',
        reason: `Strong performance on ${topicName}. Escalating from Easy to Medium difficulty.`,
      };
    }
    if (currentDiff === 'MEDIUM') {
      return {
        nextDiff: 'HARD',
        action: 'ADVANCE_DIFFICULTY',
        reason: `Demonstrated high technical proficiency on ${topicName}. Advancing to Hard difficulty.`,
      };
    }
    return {
      nextDiff: 'HARD',
      action: 'MAINTAIN_TOP_DIFFICULTY',
      reason: `Consistently strong answers at Hard difficulty. Retaining Hard level.`,
    };
  }

  if (verdict === 'PARTIAL') {
    return {
      nextDiff: currentDiff,
      action: 'MAINTAIN_DIFFICULTY',
      reason: `Moderate response on ${topicName}. Maintaining current ${currentDiff} difficulty.`,
    };
  }

  if (verdict === 'IRRELEVANT') {
    if (currentDiff === 'HARD') {
      return {
        nextDiff: 'MEDIUM',
        action: 'STEP_DOWN_DIFFICULTY',
        reason: `Answer off-topic or insufficient at Hard tier. Stepping down to Medium difficulty.`,
      };
    }
    if (currentDiff === 'MEDIUM') {
      return {
        nextDiff: 'EASY',
        action: 'STEP_DOWN_DIFFICULTY',
        reason: `Weak answer at Medium tier. Stepping down to Easy difficulty for core fundamentals.`,
      };
    }
    return {
      nextDiff: 'EASY',
      action: 'REINFORCE_BASICS',
      reason: `Candidate struggled with core concepts. Continuing at foundational Easy level.`,
    };
  }

  return {
    nextDiff: currentDiff,
    action: 'CONTINUE_EVALUATION',
    reason: `Initial introductory response recorded. Proceeding to technical assessment.`,
  };
}

/**
 * Retrieves the current pending question or selects the next question adaptively.
 * Guaranteed to be refresh-safe: reloading the page returns the identical pending question.
 *
 * @async
 * @param {string} sessionId - Interview session ID.
 * @returns {Promise<object>} Next question payload or interview completion signal.
 */
async function getNextInterviewQuestion(sessionId) {
  if (!sessionId) {
    throw new Error('sessionId is required.');
  }

  // 1. Fetch session from DB or in-memory
  let session = null;
  try {
    session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        candidate: true,
        responses: {
          include: {
            question: {
              include: { topic: true },
            },
          },
          orderBy: { timestamp: 'asc' },
        },
      },
    });
  } catch (err) {
    // If Prisma/DB connection unavailable, return fallback
  }

  // Check if session has been terminated early
  const termination = sessionTerminations.get(sessionId);
  if (termination || (session && session.endTime !== null)) {
    return {
      interviewComplete: true,
      sessionId,
      terminatedEarly: Boolean(termination),
      terminationReason: termination?.reason || null,
      message: 'Interview session has ended.',
    };
  }

  const responses = session?.responses || [];
  const answeredQuestionIds = responses.map((r) => r.questionId);
  const answeredCount = answeredQuestionIds.length;
  const TOTAL_QUESTIONS = 10;

  // If candidate has completed total questions, conclude session
  if (answeredCount >= TOTAL_QUESTIONS) {
    try {
      await prisma.session.update({
        where: { id: sessionId },
        data: { endTime: new Date() },
      });
    } catch (_) {}

    return {
      interviewComplete: true,
      sessionId,
      totalAnswered: answeredCount,
      message: 'Interview completed. All assessment questions concluded.',
    };
  }

  // Check if we already have an active question pending for this session that has NOT been answered
  const pending = sessionActiveQuestions.get(sessionId);
  if (pending && !answeredQuestionIds.includes(pending.question.id)) {
    // Refresh safety: return the exact pending question!
    return buildQuestionPayload(session, pending.question, answeredCount + 1, TOTAL_QUESTIONS, pending.isSimplified);
  }

  // Otherwise, select the next question adaptively!
  const asdData = loadAsdQuestions();
  let nextQ = null;
  let isSimplified = false;
  let engineDecision = null;

  if (answeredCount === 0) {
    // Phase 1: Icebreaker question
    // Try to find icebreaker from DB
    try {
      nextQ = await prisma.question.findFirst({
        where: { levelTag: 'ICEBREAKER' },
        include: { topic: true },
        orderBy: { id: 'asc' },
      });
    } catch (_) {}

    if (!nextQ && asdData.icebreakers && asdData.icebreakers.length > 0) {
      nextQ = asdData.icebreakers[0];
    }

    engineDecision = {
      action: 'ICEBREAKER_PHASE',
      reason: 'Standard opening icebreaker question to establish candidate rapport.',
      currentTopic: 'Candidate Background',
      currentDifficulty: 'EASY',
    };
  } else {
    // Technical questions (2 to 10)
    const lastResponse = responses[responses.length - 1];
    const lastQ = lastResponse?.question;
    const lastVerdict = lastResponse?.verdict || 'STRONG';
    const lastTopicName = lastQ?.topic?.name || 'Requirements Analysis';
    const currentDiff = lastQ?.difficulty || 'EASY';

    const transition = calculateDifficultyTransition(currentDiff, lastVerdict, lastTopicName);

    // If last verdict was IRRELEVANT or PARTIAL and question has a follow-up, check for simplified follow-up
    if ((lastVerdict === 'IRRELEVANT' || lastVerdict === 'PARTIAL') && lastQ?.id) {
      try {
        const followUp = await prisma.question.findFirst({
          where: {
            parentQId: lastQ.id,
            id: { notIn: answeredQuestionIds },
          },
          include: { topic: true },
        });
        if (followUp) {
          nextQ = followUp;
          isSimplified = true;
          transition.action = 'OFFER_SIMPLIFIED_FOLLOWUP';
          transition.reason = `Candidate had difficulty with previous question. Providing simplified clarifying follow-up.`;
        }
      } catch (_) {}
    }

    // If no follow-up selected, find next question matching target difficulty
    if (!nextQ) {
      try {
        nextQ = await prisma.question.findFirst({
          where: {
            difficulty: transition.nextDiff,
            levelTag: 'TECHNICAL',
            id: { notIn: answeredQuestionIds },
          },
          include: { topic: true },
          orderBy: { id: 'asc' },
        });
      } catch (_) {}
    }

    // Fallback if no questions at that difficulty remain
    if (!nextQ) {
      try {
        nextQ = await prisma.question.findFirst({
          where: {
            id: { notIn: answeredQuestionIds },
            levelTag: 'TECHNICAL',
          },
          include: { topic: true },
          orderBy: { id: 'asc' },
        });
      } catch (_) {}
    }

    // Fallback to JSON seed if DB had no rows
    if (!nextQ && asdData.questions) {
      nextQ = asdData.questions.find((q) => !answeredQuestionIds.includes(q.id));
    }

    engineDecision = {
      action: transition.action,
      reason: transition.reason,
      currentTopic: nextQ?.topic?.name || nextQ?.topicId || 'Systems Engineering',
      currentDifficulty: transition.nextDiff,
    };
  }

  // If still no question available, conclude interview
  if (!nextQ) {
    try {
      await prisma.session.update({
        where: { id: sessionId },
        data: { endTime: new Date() },
      });
    } catch (_) {}

    return {
      interviewComplete: true,
      sessionId,
      totalAnswered: answeredCount,
      message: 'Interview completed. Question pool exhausted.',
    };
  }

  // Store active question in memory to ensure refresh safety
  sessionActiveQuestions.set(sessionId, {
    question: nextQ,
    isSimplified,
    engineDecision,
  });

  // Append to audit log
  const currentLogs = sessionAuditLogs.get(sessionId) || [];
  currentLogs.push({
    step: answeredCount + 1,
    action: engineDecision.action,
    reason: engineDecision.reason,
    timestamp: new Date().toISOString(),
    topic: nextQ.topic?.name || 'General',
    difficulty: nextQ.difficulty || 'EASY',
  });
  sessionAuditLogs.set(sessionId, currentLogs);

  return buildQuestionPayload(session, nextQ, answeredCount + 1, TOTAL_QUESTIONS, isSimplified);
}

/**
 * Helper to construct the unified question payload
 */
function buildQuestionPayload(session, question, questionNumber, totalQuestions, isSimplified) {
  const responses = session?.responses || [];
  const lastResponse = responses.length > 0 ? responses[responses.length - 1] : null;

  // Build progression array
  const difficultyProgression = responses.map((r, idx) => ({
    step: idx + 1,
    difficulty: r.question?.difficulty || 'EASY',
    verdict: r.verdict || 'NOT_SCORED',
    topic: r.question?.topic?.name || 'General',
  }));

  const activeState = sessionActiveQuestions.get(session?.id);
  const decision = activeState?.engineDecision || {
    action: question.levelTag === 'ICEBREAKER' ? 'INITIAL_PROMPT' : 'ASSESS_COMPETENCY',
    reason: question.levelTag === 'ICEBREAKER'
      ? 'Introductory icebreaker to establish background.'
      : 'Technical assessment question.',
    currentTopic: question.topic?.name || 'Avionics & Systems',
    currentDifficulty: question.difficulty || 'EASY',
  };

  return {
    interviewComplete: false,
    sessionId: session?.id,
    questionNumber,
    totalQuestions,
    phase: question.levelTag === 'ICEBREAKER' ? 'Icebreaker' : 'Technical',
    question: {
      id: question.id,
      questionText: question.questionText,
      topicName: question.topic?.name || 'Requirements Analysis',
      difficulty: question.difficulty || 'EASY',
      isSimplified: Boolean(isSimplified),
    },
    candidate: {
      id: session?.candidate?.id,
      name: session?.candidate?.name || 'Candidate',
      postApplied: session?.candidate?.postApplied || 'Scientist ‘B’ / ASD',
    },
    lastAnswerDetails: lastResponse
      ? {
          relevancy: lastResponse.relevancyScore,
          correctness: lastResponse.correctnessScore,
          answerScore: lastResponse.answerScore,
          verdict: lastResponse.verdict,
          flags: lastResponse.breakdown?.flags || [],
          matchedKeywords: lastResponse.breakdown?.matchedKeywords || [],
          missingKeywords: lastResponse.breakdown?.missingKeywords || [],
          engineDecision: decision,
          currentTopic: question.topic?.name || 'Systems Engineering',
          currentDifficulty: question.difficulty || 'EASY',
        }
      : null,
    difficultyProgression,
  };
}

/**
 * Terminates an interview session early with an examiner reason.
 *
 * @async
 * @param {string} sessionId
 * @param {string} reason
 * @returns {Promise<object>}
 */
async function terminateSessionEarly(sessionId, reason) {
  if (!sessionId) {
    throw new Error('sessionId is required.');
  }

  const terminationRecord = {
    sessionId,
    terminatedEarly: true,
    reason: (reason || '').trim() || 'Terminated early by presiding board examiner.',
    terminatedAt: new Date().toISOString(),
  };

  sessionTerminations.set(sessionId, terminationRecord);

  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: { endTime: new Date() },
    });
  } catch (_) {}

  // Log to audit
  const logs = sessionAuditLogs.get(sessionId) || [];
  logs.push({
    event: 'EARLY_TERMINATION',
    action: 'TERMINATE_INTERVIEW',
    reason: terminationRecord.reason,
    timestamp: terminationRecord.terminatedAt,
  });
  sessionAuditLogs.set(sessionId, logs);

  return {
    success: true,
    sessionId,
    terminatedEarly: true,
    reason: terminationRecord.reason,
  };
}

/**
 * Retrieves audit logs for a session
 */
function getSessionAuditLogs(sessionId) {
  return sessionAuditLogs.get(sessionId) || [];
}

/**
 * Retrieves termination record for a session
 */
function getSessionTermination(sessionId) {
  return sessionTerminations.get(sessionId) || null;
}

module.exports = {
  getNextInterviewQuestion,
  terminateSessionEarly,
  getSessionAuditLogs,
  getSessionTermination,
};

