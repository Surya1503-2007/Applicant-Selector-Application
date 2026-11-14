/**
 * @file interviewService.js
 * @description Orchestration service for conducting adaptive interview sessions.
 * Manages the interview lifecycle from skill-match screening through warm-up icebreakers
 * and adaptive technical questioning ladders, backed by Prisma transactions and audit logging.
 */

const prisma = require('../db/prismaClient');
const sessionService = require('./sessionService');
const questionService = require('./questionService');
const skillMatchService = require('./skillMatchService');
const answerScoringService = require('./answerScoringService');
const { decideNext } = require('../engine/adaptiveEngine');
const {
  PHASES,
  ACTIONS,
  END_REASONS,
  DIFFICULTIES,
} = require('../config/engineConfig');

/**
 * Sanitizes a question object for candidate-facing delivery, stripping sensitive
 * grading assets (idealAnswer, keywords) and selecting simplified text if it's a re-ask.
 *
 * @param {object} question - Prisma question entity.
 * @param {boolean} [isReask=false] - Whether this question is presented as a simplified re-ask.
 * @returns {object} Candidate-safe question payload.
 */
function sanitizeQuestionForCandidate(question, isReask = false) {
  if (!question) return null;

  const displayPrompt =
    isReask && question.simplifiedText
      ? question.simplifiedText
      : question.questionText;

  return {
    id: question.id,
    difficulty: question.difficulty,
    levelTag: question.levelTag,
    questionText: displayPrompt,
    isReask: Boolean(isReask),
    topic: question.topic
      ? { id: question.topic.id, name: question.topic.name }
      : null,
  };
}

/**
 * Compiles a snapshot of unasked question availability across all topics in the subject.
 *
 * @async
 * @param {string} sessionId - Interview session ID.
 * @param {string} [currentQuestionId] - ID of the active question to check for follow-ups.
 * @returns {Promise<{
 *   topicOrder: string[],
 *   availablePerTopic: object,
 *   hasFollowUp: boolean,
 *   availableIcebreakers: number,
 *   totalAvailableInPool: number
 * }>}
 */
async function getPoolAvailability(sessionId, currentQuestionId = null) {
  const askedIds = await sessionService.getAskedQuestionIds(sessionId);

  // Identify subject domain for this session via candidate's latest skill match or post applied
  let subjectId = null;
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      candidate: {
        include: {
          skillMatchResults: { orderBy: { createdAt: 'desc' }, take: 1, include: { post: true } },
        },
      },
    },
  });

  if (session?.candidate?.skillMatchResults?.[0]?.post?.subjectId) {
    subjectId = session.candidate.skillMatchResults[0].post.subjectId;
  } else if (session?.candidate?.postApplied) {
    const matchedPost = await prisma.post.findFirst({
      where: {
        OR: [
          { id: session.candidate.postApplied },
          { title: session.candidate.postApplied },
        ],
      },
    });
    if (matchedPost) subjectId = matchedPost.subjectId;
  }

  // Load topics in order (scoped to subject if resolved, or all topics as fallback)
  const topicWhere = subjectId ? { subjectId } : {};
  const topics = await prisma.topic.findMany({
    where: topicWhere,
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });
  const topicOrder = topics.map((t) => t.id);

  // Group unasked questions by topicId and difficulty
  const unaskedQuestions = await prisma.question.findMany({
    where: {
      id: { notIn: askedIds },
      levelTag: { not: 'ICEBREAKER' },
      topicId: { in: topicOrder },
    },
    select: {
      id: true,
      topicId: true,
      difficulty: true,
    },
  });

  const availablePerTopic = {};
  for (const tid of topicOrder) {
    availablePerTopic[tid] = {
      EASY: 0,
      MEDIUM: 0,
      HARD: 0,
      total: 0,
    };
  }

  for (const q of unaskedQuestions) {
    if (availablePerTopic[q.topicId]) {
      availablePerTopic[q.topicId][q.difficulty]++;
      availablePerTopic[q.topicId].total++;
    }
  }

  // Count unasked icebreakers
  const availableIcebreakers = await prisma.question.count({
    where: {
      levelTag: 'ICEBREAKER',
      id: { notIn: askedIds },
    },
  });

  // Check if current question has an unasked follow-up
  let hasFollowUp = false;
  if (currentQuestionId) {
    const followUps = await questionService.getFollowupQuestions(currentQuestionId);
    hasFollowUp = followUps.some((f) => !askedIds.includes(f.id));
  }

  return {
    topicOrder,
    availablePerTopic,
    hasFollowUp,
    availableIcebreakers,
    totalAvailableInPool: unaskedQuestions.length,
  };
}

/**
 * Initializes and starts a new interview session.
 * 1. Creates session record (Part 1).
 * 2. Runs and attaches candidate skill-match suitability screening (Part 2).
 * 3. Initializes SessionState and records Step 0 in DecisionLog.
 * 4. Returns the first warm-up question.
 *
 * @async
 * @param {string} candidateId - Candidate ID.
 * @param {string} postId - Post ID.
 * @returns {Promise<{
 *   sessionId: string,
 *   candidateId: string,
 *   postId: string,
 *   skillMatchSummary: object,
 *   firstQuestion: object
 * }>}
 */
async function startInterview(candidateId, postId) {
  if (!candidateId || !postId) {
    const err = new Error('Both candidateId and postId are required to initiate an interview.');
    err.statusCode = 400;
    throw err;
  }

  // Verify candidate & post existence
  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) {
    const err = new Error(`Candidate with ID "${candidateId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    const err = new Error(`Post with ID "${postId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  // 1. Create interview session
  const session = await sessionService.createSession(candidateId);

  // 2. Compute Part 2 skill-match suitability score
  const skillMatch = await skillMatchService.computeSkillMatch(candidateId, postId);

  // 3. Select first question (Icebreaker first)
  const icebreakers = await questionService.getIcebreakerQuestions([]);
  if (!icebreakers || icebreakers.length === 0) {
    throw new Error('No icebreaker questions found in database question bank.');
  }
  const firstQuestion = icebreakers[0];

  // 4. Initialize SessionState and DecisionLog in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.sessionState.create({
      data: {
        sessionId: session.id,
        currentTopicId: null,
        currentDifficulty: null,
        currentQuestionId: firstQuestion.id,
        phase: PHASES.ICEBREAKER,
        technicalCount: 0,
        icebreakerCount: 0,
        consecutiveIrrelevant: 0,
        topicProgress: {},
        status: 'ACTIVE',
      },
    });

    await tx.decisionLog.create({
      data: {
        sessionId: session.id,
        step: 0,
        questionId: firstQuestion.id,
        verdict: null,
        fromDifficulty: null,
        toDifficulty: null,
        action: ACTIONS.ICEBREAKER,
        reason: 'Interview session initiated. Presenting initial warm-up icebreaker question.',
      },
    });
  });

  return {
    sessionId: session.id,
    candidateId,
    postId,
    skillMatchSummary: {
      matchPercent: skillMatch.matchPercent,
      band: skillMatch.band,
      mandatoryGap: skillMatch.mandatoryGap,
      missingMandatory: skillMatch.missingMandatory,
    },
    firstQuestion: sanitizeQuestionForCandidate(firstQuestion, false),
  };
}

/**
 * Returns the currently pending question for an active session.
 * Fully idempotent: refreshing or calling multiple times never modifies session state or skips questions.
 *
 * @async
 * @param {string} sessionId - Unique identifier of the session.
 * @returns {Promise<{
 *   sessionId: string,
 *   phase: string,
 *   isComplete: boolean,
 *   endReason?: string|null,
 *   question: object|null
 * }>}
 */
async function getCurrentQuestion(sessionId) {
  if (!sessionId) {
    const err = new Error('sessionId is required.');
    err.statusCode = 400;
    throw err;
  }

  const sessionState = await prisma.sessionState.findUnique({
    where: { sessionId },
  });

  if (!sessionState) {
    const err = new Error(`Interview state not found for session "${sessionId}".`);
    err.statusCode = 404;
    throw err;
  }

  if (sessionState.status === 'COMPLETED' || !sessionState.currentQuestionId) {
    return {
      sessionId,
      phase: sessionState.phase,
      isComplete: true,
      endReason: sessionState.endReason,
      question: null,
    };
  }

  const question = await questionService.getQuestionById(sessionState.currentQuestionId);
  if (!question) {
    throw new Error(`Active question "${sessionState.currentQuestionId}" could not be found.`);
  }

  // Check if current question is designated as a simplified re-ask
  const latestLog = await prisma.decisionLog.findFirst({
    where: { sessionId },
    orderBy: { step: 'desc' },
  });
  const isReask = latestLog && latestLog.action === ACTIONS.REASK_SIMPLIFIED;

  return {
    sessionId,
    phase: sessionState.phase,
    isComplete: false,
    question: sanitizeQuestionForCandidate(question, isReask),
  };
}

/**
 * Evaluates a candidate's answer to the pending question, updates the adaptive state machine,
 * selects the next appropriate question, and persists audit logs in a single transaction.
 *
 * @async
 * @param {string} sessionId - Interview session ID.
 * @param {string} answerText - Candidate's answer text.
 * @returns {Promise<{
 *   scoring: {
 *     relevancy: number|null,
 *     correctness: number|null,
 *     answerScore: number|null,
 *     verdict: string,
 *     isExaminerOnly: boolean
 *   },
 *   decision: {
 *     action: string,
 *     reason: string,
 *     step: number
 *   },
 *   nextQuestion: object|null,
 *   interviewComplete: boolean,
 *   endReason?: string|null
 * }>}
 */
async function submitAnswer(sessionId, answerText) {
  if (!sessionId || typeof sessionId !== 'string') {
    const err = new Error('sessionId is required.');
    err.statusCode = 400;
    throw err;
  }

  if (typeof answerText !== 'string') {
    const err = new Error('answerText is required and must be a string.');
    err.statusCode = 400;
    throw err;
  }

  // Guard: Verify session status outside transaction first
  const currentState = await prisma.sessionState.findUnique({
    where: { sessionId },
  });
  if (!currentState) {
    const err = new Error(`Session "${sessionId}" does not exist.`);
    err.statusCode = 404;
    throw err;
  }

  if (currentState.status === 'COMPLETED') {
    const err = new Error(`Interview session "${sessionId}" has already completed. Answers cannot be submitted.`);
    err.statusCode = 400;
    throw err;
  }

  const activeQuestionId = currentState.currentQuestionId;
  if (!activeQuestionId) {
    const err = new Error(`Session "${sessionId}" has no active question.`);
    err.statusCode = 400;
    throw err;
  }

  const question = await questionService.getQuestionById(activeQuestionId);
  if (!question) {
    throw new Error(`Current question "${activeQuestionId}" not found in database.`);
  }

  // Check if current step was a simplified re-ask
  const latestLog = await prisma.decisionLog.findFirst({
    where: { sessionId },
    orderBy: { step: 'desc' },
  });
  const isCurrentReask = latestLog && latestLog.action === ACTIONS.REASK_SIMPLIFIED;

  // 1. Score and save response (Part 3)
  const scoredResponse = await answerScoringService.scoreAndSaveResponse(
    sessionId,
    activeQuestionId,
    answerText,
    undefined,
    isCurrentReask
  );

  const verdict = scoredResponse.verdict;

  // 2. Fetch unasked pool availability
  const availability = await getPoolAvailability(sessionId, activeQuestionId);

  // 3. Compute next state via pure engine function
  const decision = decideNext(currentState, verdict, { ...question, isReask: isCurrentReask }, availability);

  // 4. Resolve next question based on engine decision
  const askedIds = await sessionService.getAskedQuestionIds(sessionId);
  let nextQuestionEntity = null;
  let isNextReask = false;

  // Part 7C: Check if an expert question is queued
  let updatedExpertQueue = Array.isArray(currentState.expertQueue)
    ? [...currentState.expertQueue]
    : [];

  if (updatedExpertQueue.length > 0 && decision.action !== ACTIONS.REASK_SIMPLIFIED && decision.action !== ACTIONS.END) {
    const nextExpertQId = updatedExpertQueue.shift();
    const expertQ = await questionService.getQuestionById(nextExpertQId);
    if (expertQ && !askedIds.includes(expertQ.id)) {
      nextQuestionEntity = expertQ;
      decision.action = 'EXPERT_INJECTED';
      decision.reason = `Serving examiner-injected expert question "${expertQ.id}". Adaptive ladder state preserved.`;
    }
  }

  if (!nextQuestionEntity) {
    if (decision.action === ACTIONS.REASK_SIMPLIFIED) {
      // Same question in simplified form
      nextQuestionEntity = question;
      isNextReask = true;
    } else if (decision.action === ACTIONS.ICEBREAKER) {
      const unaskedIcebreakers = await questionService.getIcebreakerQuestions(askedIds);
      nextQuestionEntity = unaskedIcebreakers.length > 0 ? unaskedIcebreakers[0] : null;
    } else if (decision.action === ACTIONS.END) {
      nextQuestionEntity = null;
    } else {
      // Technical question selection
      const targetTopicId = decision.nextTopicId;
      const targetDifficulty = decision.nextDifficulty || DIFFICULTIES.EASY;

      // Check if advancing to MEDIUM and a linked follow-up question exists
      if (decision.action === ACTIONS.NEXT_HARDER && targetDifficulty === DIFFICULTIES.MEDIUM) {
        const followUps = await questionService.getFollowupQuestions(activeQuestionId);
        const unaskedFollowUp = followUps.find((f) => !askedIds.includes(f.id));
        if (unaskedFollowUp) {
          nextQuestionEntity = unaskedFollowUp;
        }
      }

      // Default question pick from topic and difficulty
      if (!nextQuestionEntity && targetTopicId) {
        nextQuestionEntity = await questionService.getNextQuestion(
          targetTopicId,
          targetDifficulty,
          askedIds
        );

        // Graceful fallback: If target difficulty not available, pick any unasked from topic
        if (!nextQuestionEntity) {
          const fallbackDifficulties = [DIFFICULTIES.EASY, DIFFICULTIES.MEDIUM, DIFFICULTIES.HARD];
          for (const diff of fallbackDifficulties) {
            nextQuestionEntity = await questionService.getNextQuestion(targetTopicId, diff, askedIds);
            if (nextQuestionEntity) {
              decision.reason += ` (Fallback: Selected ${diff} question due to pool availability).`;
              break;
            }
          }
        }
      }
    }
  }

  // If engine did not end, but no question could be found in the entire pool:
  if (!nextQuestionEntity && decision.action !== ACTIONS.END) {
    decision.action = ACTIONS.END;
    decision.end = { reason: END_REASONS.POOL_EXHAUSTED };
    decision.reason += ' -> No unasked question could be selected; question pool exhausted.';
  }

  // 5. Atomic state update & decision logging in a Prisma transaction
  const stepCount = (latestLog ? latestLog.step : 0) + 1;
  const isInterviewEnding = decision.action === ACTIONS.END;

  await prisma.$transaction(async (tx) => {
    // Update topicProgress
    const updatedTopicProgress = currentState.topicProgress
      ? JSON.parse(JSON.stringify(currentState.topicProgress))
      : {};

    if (question.topicId) {
      if (!updatedTopicProgress[question.topicId]) {
        updatedTopicProgress[question.topicId] = {
          easyAsked: 0,
          mediumAsked: 0,
          hardAsked: 0,
          finished: false,
          lastVerdict: null,
          reaskUsed: false,
        };
      }
      const prog = updatedTopicProgress[question.topicId];
      if (question.difficulty === 'EASY') prog.easyAsked++;
      if (question.difficulty === 'MEDIUM') prog.mediumAsked++;
      if (question.difficulty === 'HARD') prog.hardAsked++;
      prog.lastVerdict = verdict;
      if (decision.action === ACTIONS.REASK_SIMPLIFIED) {
        prog.reaskUsed = true;
      } else {
        prog.reaskUsed = false;
      }
      if (decision.action === ACTIONS.NEXT_TOPIC) {
        prog.finished = true;
      }
    }

    // Check if the answered question was an injected expert question
    const isExpertInjected = question.source === 'EXPERT';

    const updatedTechnicalCount =
      question.levelTag !== 'ICEBREAKER' && !isExpertInjected
        ? currentState.technicalCount + 1
        : currentState.technicalCount;

    const updatedIcebreakerCount =
      question.levelTag === 'ICEBREAKER'
        ? currentState.icebreakerCount + 1
        : currentState.icebreakerCount;

    // Icebreakers and Expert-injected questions never affect the struggling counter
    const isSpecialQuestion = question.levelTag === 'ICEBREAKER' || isExpertInjected;
    const updatedConsecutiveIrrelevant = isSpecialQuestion
      ? currentState.consecutiveIrrelevant
      : verdict === 'IRRELEVANT'
        ? currentState.consecutiveIrrelevant + 1
        : 0;

    const nextPhase = isInterviewEnding
      ? PHASES.COMPLETED
      : decision.nextPhase || (nextQuestionEntity && nextQuestionEntity.levelTag === 'ICEBREAKER' ? PHASES.ICEBREAKER : PHASES.TECHNICAL);

    await tx.sessionState.update({
      where: { sessionId },
      data: {
        currentTopicId: nextQuestionEntity ? nextQuestionEntity.topicId : null,
        currentDifficulty: nextQuestionEntity ? nextQuestionEntity.difficulty : null,
        currentQuestionId: nextQuestionEntity ? nextQuestionEntity.id : null,
        phase: nextPhase,
        technicalCount: updatedTechnicalCount,
        icebreakerCount: updatedIcebreakerCount,
        consecutiveIrrelevant: updatedConsecutiveIrrelevant,
        topicProgress: updatedTopicProgress,
        expertQueue: updatedExpertQueue,
        status: isInterviewEnding ? 'COMPLETED' : 'ACTIVE',
        endReason: isInterviewEnding && decision.end ? decision.end.reason : null,
      },
    });

    await tx.decisionLog.create({
      data: {
        sessionId,
        step: stepCount,
        questionId: question.id,
        verdict,
        fromDifficulty: question.difficulty,
        toDifficulty: nextQuestionEntity ? nextQuestionEntity.difficulty : null,
        action: decision.action,
        reason: decision.reason,
      },
    });

    if (isInterviewEnding) {
      await tx.session.update({
        where: { id: sessionId },
        data: { endTime: new Date() },
      });
    }
  });

  // Part 5 Hook: Automatically generate assessment report upon completion
  // Failure to generate report must NOT fail or rollback interview completion
  if (isInterviewEnding) {
    try {
      const reportService = require('./reportService');
      await reportService.generateReport(sessionId);
    } catch (reportErr) {
      console.error(
        `[Part 5] Automatic report generation failed for completed session "${sessionId}":`,
        reportErr.message
      );
    }
  }

  return {
    scoring: {
      relevancy: scoredResponse.relevancy,
      correctness: scoredResponse.correctness,
      answerScore: scoredResponse.answerScore,
      verdict: scoredResponse.verdict,
      // Flagged for examiner dashboard; candidate UI must hide this
      isExaminerOnly: true,
    },
    decision: {
      action: decision.action,
      reason: decision.reason,
      step: stepCount,
    },
    nextQuestion: sanitizeQuestionForCandidate(nextQuestionEntity, isNextReask),
    interviewComplete: isInterviewEnding,
    endReason: isInterviewEnding && decision.end ? decision.end.reason : null,
  };
}

/**
 * Returns current interview state along with the full decision audit trail.
 *
 * @async
 * @param {string} sessionId - Interview session ID.
 * @returns {Promise<{
 *   state: object,
 *   decisionLog: Array<object>
 * }>}
 */
async function getInterviewState(sessionId) {
  if (!sessionId) {
    const err = new Error('sessionId is required.');
    err.statusCode = 400;
    throw err;
  }

  const sessionState = await prisma.sessionState.findUnique({
    where: { sessionId },
    include: {
      session: {
        select: {
          id: true,
          candidateId: true,
          startTime: true,
          endTime: true,
          candidate: {
            select: { id: true, name: true, postApplied: true },
          },
        },
      },
    },
  });

  if (!sessionState) {
    const err = new Error(`Interview state for session "${sessionId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  const decisionLogs = await prisma.decisionLog.findMany({
    where: { sessionId },
    orderBy: { step: 'asc' },
  });

  return {
    state: sessionState,
    decisionLog: decisionLogs,
  };
}

/**
 * Manually concludes an interview early (e.g. by board intervention).
 *
 * @async
 * @param {string} sessionId - Interview session ID.
 * @param {string} [reason='BOARD_TERMINATED'] - Termination reason.
 * @returns {Promise<object>} Updated session state.
 */
async function endInterviewEarly(sessionId, reason = END_REASONS.BOARD_TERMINATED) {
  if (!sessionId) {
    const err = new Error('sessionId is required.');
    err.statusCode = 400;
    throw err;
  }

  const sessionState = await prisma.sessionState.findUnique({
    where: { sessionId },
  });

  if (!sessionState) {
    const err = new Error(`Interview state for session "${sessionId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  if (sessionState.status === 'COMPLETED') {
    return sessionState;
  }

  const latestLog = await prisma.decisionLog.findFirst({
    where: { sessionId },
    orderBy: { step: 'desc' },
  });
  const stepCount = (latestLog ? latestLog.step : 0) + 1;

  await prisma.$transaction(async (tx) => {
    await tx.sessionState.update({
      where: { sessionId },
      data: {
        status: 'COMPLETED',
        phase: PHASES.COMPLETED,
        endReason: reason,
      },
    });

    await tx.session.update({
      where: { id: sessionId },
      data: { endTime: new Date() },
    });

    await tx.decisionLog.create({
      data: {
        sessionId,
        step: stepCount,
        questionId: sessionState.currentQuestionId,
        verdict: null,
        fromDifficulty: sessionState.currentDifficulty,
        toDifficulty: null,
        action: ACTIONS.END,
        reason: `Interview manually terminated by assessment board: "${reason}".`,
      },
    });
  });

  // Part 5 Hook: Automatically generate assessment report upon early termination
  try {
    const reportService = require('./reportService');
    await reportService.generateReport(sessionId);
  } catch (reportErr) {
    console.error(
      `[Part 5] Automatic report generation failed for terminated session "${sessionId}":`,
      reportErr.message
    );
  }

  return prisma.sessionState.findUnique({
    where: { sessionId },
  });
}

/**
 * Injects an expert-authored question into an ongoing interview session.
 * Creates the question with source='EXPERT' and appends it to sessionState.expertQueue.
 *
 * @async
 * @param {string} sessionId - Interview session ID.
 * @param {object} questionData - Question payload.
 * @param {string} questionData.questionText - Prompt text.
 * @param {string} [questionData.topicId] - Topic ID.
 * @param {('EASY'|'MEDIUM'|'HARD')} [questionData.difficulty='MEDIUM'] - Difficulty.
 * @param {string} questionData.idealAnswer - Reference grading text.
 * @param {string[]} questionData.keywords - Required grading keywords.
 * @param {string} [questionData.createdById] - Examiner User ID.
 * @returns {Promise<{
 *   success: boolean,
 *   question: object,
 *   expertQueueLength: number,
 *   relevancyPreview?: object
 * }>}
 */
async function injectExpertQuestion(sessionId, questionData) {
  if (!sessionId) {
    const err = new Error('sessionId is required.');
    err.statusCode = 400;
    throw err;
  }

  const sessionState = await prisma.sessionState.findUnique({
    where: { sessionId },
    include: {
      session: {
        include: {
          candidate: { include: { skills: true } },
          reports: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  });

  if (!sessionState) {
    const err = new Error(`Session "${sessionId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  if (sessionState.status === 'COMPLETED') {
    const err = new Error(`Session "${sessionId}" is already completed; cannot inject questions.`);
    err.statusCode = 400;
    throw err;
  }

  const {
    questionText,
    topicId,
    difficulty = 'MEDIUM',
    idealAnswer,
    keywords = [],
    createdById,
  } = questionData || {};

  if (!questionText || typeof questionText !== 'string' || !questionText.trim()) {
    const err = new Error('questionText is required and must be a string.');
    err.statusCode = 400;
    throw err;
  }

  if (!idealAnswer || typeof idealAnswer !== 'string' || !idealAnswer.trim()) {
    const err = new Error('idealAnswer is required for expert-injected questions.');
    err.statusCode = 400;
    throw err;
  }

  if (!Array.isArray(keywords) || keywords.length === 0) {
    const err = new Error('keywords array with at least one keyword is required.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Create Question record with source='EXPERT'
  const newQuestion = await prisma.question.create({
    data: {
      topicId: topicId || null,
      difficulty,
      questionText: questionText.trim(),
      idealAnswer: idealAnswer.trim(),
      keywords: keywords.map((k) => String(k).trim()).filter(Boolean),
      levelTag: 'TECHNICAL',
      source: 'EXPERT',
      createdById: createdById || null,
      status: 'ACTIVE',
    },
  });

  // 2. Queue expert question so it is asked next:
  // "creates an EXPERT question and queues it next."
  // If the active question is pending and hasn't been answered, we replace currentQuestionId with this expert question,
  // pushing any previous pending question into the queue so the immediate next ask is this expert question.
  const previousPendingId = sessionState.currentQuestionId;

  const currentQueue = Array.isArray(sessionState.expertQueue)
    ? [...sessionState.expertQueue]
    : [];

  // If there was an unasked pending question and it's not the new expert question, keep it queued after
  if (previousPendingId && previousPendingId !== newQuestion.id) {
    currentQueue.push(previousPendingId);
  }

  // Update sessionState so the expert question is immediately current
  await prisma.sessionState.update({
    where: { sessionId },
    data: {
      currentQuestionId: newQuestion.id,
      currentDifficulty: newQuestion.difficulty,
      currentTopicId: newQuestion.topicId || null,
      expertQueue: currentQueue,
    },
  });

  // 3. Compute relevancy preview & record ExpertQuestionScore telemetry if candidate/post known
  let relevancyScore = 0.5;
  let isLowFit = false;

  try {
    const { scoreQuestionRelevancy } = require('../reports/questionRelevancy');
    const candidateSkills = (sessionState.session?.candidate?.skills || []).map((s) => s.skillName);
    const postSkills = []; // optionally load post skills if post is available

    const relResult = scoreQuestionRelevancy({
      question: {
        questionText: newQuestion.questionText,
        keywords: newQuestion.keywords,
      },
      candidateSkills,
      postSkills,
    });
    relevancyScore = relResult.questionRelevancy;
    isLowFit = relResult.isLowFit;

    // Persist ExpertQuestionScore record
    await prisma.expertQuestionScore.create({
      data: {
        userId: createdById || 'examiner-anonymous',
        sessionId,
        questionId: newQuestion.id,
        avgRelevancy: Math.round(relevancyScore * 100 * 100) / 100,
        countAsked: 1,
        countLowFit: isLowFit ? 1 : 0,
      },
    });
  } catch (err) {
    console.warn('[Part 7C] Could not compute expert question telemetry:', err.message);
  }

  return {
    success: true,
    question: newQuestion,
    expertQueueLength: currentQueue.length,
    relevancyScore: Math.round(relevancyScore * 100 * 100) / 100,
    isLowFit,
  };
}

module.exports = {
  startInterview,
  getCurrentQuestion,
  submitAnswer,
  getInterviewState,
  endInterviewEarly,
  injectExpertQuestion,
  sanitizeQuestionForCandidate,
  getPoolAvailability,
};

