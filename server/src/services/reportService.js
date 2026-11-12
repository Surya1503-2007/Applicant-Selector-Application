/**
 * @file reportService.js
 * @description Orchestration service for generating, retrieving, overriding, and querying
 * immutable interview assessment reports (Part 5).
 * Integrates Part 1 Session & Responses, Part 2 Skill-Match, Part 3 Scored Answers,
 * and Part 4 Adaptive DecisionLog into an explainable, audit-ready snapshot.
 */

const prisma = require('../db/prismaClient');
const reportConfig = require('../config/reportConfig');
const skillMatchService = require('./skillMatchService');
const {
  computeInterviewScore,
  computeTopicScores,
  computeDifficultyProgression,
  computeOverall,
  recommend,
  collectFlags,
  getResponseLevelTag,
} = require('../reports/reportCalculator');
const {
  scoreQuestionRelevancy,
  computeSessionQuestionRelevancy,
} = require('../reports/questionRelevancy');

/**
 * Generates an immutable assessment report snapshot for a completed interview session.
 *
 * Flow:
 * 1. Checks session existence and ensures session is COMPLETED (rejects ACTIVE sessions).
 * 2. Checks idempotency: if report exists and regenerate=false, returns existing snapshot.
 * 3. If regenerate=true, creates a new snapshot with incremented version.
 * 4. Loads candidate skills, post skills, and Part 2 skill-match result.
 * 5. Evaluates question relevancy for all asked technical questions.
 * 6. Invokes pure calculators to compute interviewScore, topicScores, difficultyProgression,
 *    overallScore, recommendation, and aggregated audit flags.
 * 7. Persists complete report with configSnapshot and Part 4 DecisionLog.
 *
 * @async
 * @param {string} sessionId - Interview session ID.
 * @param {object} [options={}] - Generation options.
 * @param {boolean} [options.regenerate=false] - Whether to explicitly create a new version.
 * @param {string} [options.postId] - Optional target post ID override.
 * @returns {Promise<object>} Persisted Report entity.
 */
async function generateReport(sessionId, { regenerate = false, postId = null } = {}) {
  if (!sessionId) {
    const err = new Error('sessionId is required to generate report.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Load session with candidate, state, decision log, and responses
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      candidate: {
        include: { skills: true },
      },
      sessionState: true,
      decisionLogs: {
        orderBy: { step: 'asc' },
      },
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

  if (!session) {
    const err = new Error(`Interview session "${sessionId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  // Reject active sessions
  if (session.sessionState && session.sessionState.status === 'ACTIVE') {
    const err = new Error('Session is still ACTIVE. Report can only be generated for COMPLETED sessions.');
    err.statusCode = 400;
    throw err;
  }

  // 2. Idempotency check: if report already exists and regenerate is false, return latest
  const existingLatest = await prisma.report.findFirst({
    where: { sessionId },
    orderBy: { version: 'desc' },
    include: {
      candidate: {
        select: { id: true, name: true, postApplied: true, experienceLevel: true },
      },
      post: {
        select: { id: true, title: true, level: true },
      },
    },
  });

  if (existingLatest && !regenerate) {
    return existingLatest;
  }

  const newVersion = existingLatest ? existingLatest.version + 1 : 1;

  // 3. Resolve target Post
  let resolvedPostId = postId || (existingLatest ? existingLatest.postId : null);

  if (!resolvedPostId) {
    // Check candidate's latest skill match result
    const latestSkillMatch = await prisma.skillMatchResult.findFirst({
      where: { candidateId: session.candidateId },
      orderBy: { createdAt: 'desc' },
    });
    if (latestSkillMatch) {
      resolvedPostId = latestSkillMatch.postId;
    }
  }

  if (!resolvedPostId && session.candidate.postApplied) {
    const matchedPost = await prisma.post.findFirst({
      where: {
        OR: [
          { id: session.candidate.postApplied },
          { title: session.candidate.postApplied },
        ],
      },
    });
    if (matchedPost) {
      resolvedPostId = matchedPost.id;
    }
  }

  if (!resolvedPostId) {
    const fallbackPost = await prisma.post.findFirst();
    if (!fallbackPost) {
      const err = new Error('No post found in system to associate report with.');
      err.statusCode = 400;
      throw err;
    }
    resolvedPostId = fallbackPost.id;
  }

  const post = await prisma.post.findUnique({
    where: { id: resolvedPostId },
    include: {
      postSkills: {
        orderBy: [{ isMandatory: 'desc' }, { weight: 'desc' }],
      },
    },
  });

  if (!post) {
    const err = new Error(`Post with ID "${resolvedPostId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  // 4. Retrieve or compute Part 2 SkillMatchResult
  let skillMatch = await prisma.skillMatchResult.findFirst({
    where: { candidateId: session.candidateId, postId: resolvedPostId },
    orderBy: { createdAt: 'desc' },
  });

  if (!skillMatch) {
    skillMatch = await skillMatchService.computeSkillMatch(
      session.candidateId,
      resolvedPostId
    );
  }

  // 5. Load all domain topics for the subject to report unassessed topics
  const allTopics = await prisma.topic.findMany({
    where: post.subjectId ? { subjectId: post.subjectId } : {},
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  // 6. Evaluate Question Relevancy for asked technical questions
  const candidateSkills = session.candidate.skills || [];
  const postSkills = post.postSkills || [];
  const technicalRelevancies = [];

  const questionTable = [];

  for (const resp of session.responses) {
    const isIcebreaker = getResponseLevelTag(resp) === 'ICEBREAKER';
    let qRelResult = null;

    if (!isIcebreaker && resp.question) {
      qRelResult = scoreQuestionRelevancy({
        question: resp.question,
        candidateSkills,
        postSkills,
        config: reportConfig,
      });
      technicalRelevancies.push({
        questionRelevancy: qRelResult.questionRelevancy,
        difficulty: resp.question.difficulty,
      });
    }

    questionTable.push({
      questionId: resp.questionId,
      questionText: resp.question ? resp.question.questionText : '---',
      topic: resp.question && resp.question.topic ? resp.question.topic.name : 'General',
      difficulty: resp.question ? resp.question.difficulty : 'EASY',
      levelTag: resp.question ? resp.question.levelTag : 'TECHNICAL',
      answerText: resp.answerText,
      relevancy: resp.relevancyScore,
      correctness: resp.correctnessScore,
      answerScore: resp.answerScore,
      verdict: resp.verdict,
      flags: resp.breakdown && resp.breakdown.flags ? resp.breakdown.flags : [],
      isReask: Boolean(resp.isReask),
      questionRelevancy: qRelResult ? qRelResult.questionRelevancy : null,
      isLowFit: qRelResult ? qRelResult.isLowFit : false,
    });
  }

  const sessionRelevancy = computeSessionQuestionRelevancy(
    technicalRelevancies,
    reportConfig
  );

  // 7. Pure calculation functions
  const interviewScore = computeInterviewScore(session.responses, reportConfig);
  const topicScores = computeTopicScores(session.responses, allTopics, reportConfig);
  const difficultyProgression = computeDifficultyProgression(session.responses);
  const overallScore = computeOverall(skillMatch.matchPercent, interviewScore, reportConfig);

  // Determine early termination
  const endReason = session.sessionState ? session.sessionState.endReason : null;
  const earlyReasons = reportConfig.EARLY_TERMINATION.TRIGGER_END_REASONS;
  const terminatedEarly = Boolean(
    endReason && earlyReasons.includes(endReason)
  );

  const systemRecommendation = recommend(overallScore, { terminatedEarly }, reportConfig);
  const finalRecommendation = systemRecommendation;

  const flags = collectFlags(session.responses, skillMatch, session.sessionState, {
    lowFitQuestionsCount: sessionRelevancy.lowFitCount,
    terminatedEarly,
  });

  // Map decision logs into clean snapshot array
  const decisionLogSnapshot = (session.decisionLogs || []).map((dl) => ({
    step: dl.step,
    questionId: dl.questionId,
    verdict: dl.verdict,
    fromDifficulty: dl.fromDifficulty,
    toDifficulty: dl.toDifficulty,
    action: dl.action,
    reason: dl.reason,
    createdAt: dl.createdAt,
  }));

  // Create immutable snapshot record
  const savedReport = await prisma.report.create({
    data: {
      sessionId,
      candidateId: session.candidateId,
      postId: resolvedPostId,
      version: newVersion,
      configSnapshot: JSON.parse(JSON.stringify(reportConfig)),
      skillMatchPercent: skillMatch.matchPercent,
      skillMatchBand: skillMatch.band,
      mandatoryGap: Boolean(skillMatch.mandatoryGap),
      missingMandatory: Array.isArray(skillMatch.missingMandatory)
        ? skillMatch.missingMandatory
        : [],
      interviewScore,
      overallScore,
      systemRecommendation,
      finalRecommendation,
      terminatedEarly,
      endReason,
      questionRelevancyScore: sessionRelevancy.questionRelevancyScore,
      questionRelevancyBand: sessionRelevancy.questionRelevancyBand,
      topicScores,
      questionTable,
      difficultyProgression,
      flags,
      decisionLog: decisionLogSnapshot,
    },
    include: {
      candidate: {
        select: { id: true, name: true, postApplied: true, experienceLevel: true },
      },
      post: {
        select: { id: true, title: true, level: true },
      },
    },
  });

  return savedReport;
}

/**
 * Retrieves an existing assessment report snapshot by sessionId and optional version.
 * If version is omitted, returns the latest version.
 *
 * @async
 * @param {string} sessionId - Interview session ID.
 * @param {number|string} [version] - Optional specific report version.
 * @returns {Promise<object>} Report entity with candidate and post metadata.
 */
async function getReport(sessionId, version = null) {
  if (!sessionId) {
    const err = new Error('sessionId is required.');
    err.statusCode = 400;
    throw err;
  }

  let report = null;

  if (version !== null && version !== undefined) {
    report = await prisma.report.findUnique({
      where: {
        sessionId_version: {
          sessionId,
          version: parseInt(version, 10),
        },
      },
      include: {
        candidate: {
          select: { id: true, name: true, postApplied: true, experienceLevel: true },
        },
        post: {
          select: { id: true, title: true, level: true },
        },
      },
    });
  } else {
    report = await prisma.report.findFirst({
      where: { sessionId },
      orderBy: { version: 'desc' },
      include: {
        candidate: {
          select: { id: true, name: true, postApplied: true, experienceLevel: true },
        },
        post: {
          select: { id: true, title: true, level: true },
        },
      },
    });
  }

  if (!report) {
    const err = new Error(
      version
        ? `Report for session "${sessionId}" version ${version} not found.`
        : `No report found for session "${sessionId}".`
    );
    err.statusCode = 404;
    throw err;
  }

  return report;
}

/**
 * Overrides the system recommendation for a report with assessment board decision.
 * Keeps systemRecommendation untouched, sets finalRecommendation, and requires a justification reason.
 *
 * @async
 * @param {string} sessionId - Interview session ID.
 * @param {object} params - Override parameters.
 * @param {string} params.newRecommendation - One of 'SUITABLE', 'BORDERLINE', 'NOT_SUITABLE'.
 * @param {string} params.reason - Board justification (MANDATORY).
 * @param {string} [params.remarks] - Optional board remarks.
 * @param {string} [params.overriddenBy] - Examiner or board member identifier.
 * @param {number} [params.version] - Specific report version to override (defaults to latest).
 * @returns {Promise<object>} Updated Report entity.
 */
async function overrideRecommendation(
  sessionId,
  { newRecommendation, reason, remarks = null, overriddenBy = null, version = null } = {}
) {
  if (!sessionId) {
    const err = new Error('sessionId is required.');
    err.statusCode = 400;
    throw err;
  }

  const validRecs = Object.values(reportConfig.RECOMMENDATIONS);
  if (!newRecommendation || !validRecs.includes(newRecommendation)) {
    const err = new Error(
      `Invalid recommendation "${newRecommendation}". Must be one of: ${validRecs.join(', ')}`
    );
    err.statusCode = 400;
    throw err;
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    const err = new Error('A non-empty reason is mandatory to override recommendation.');
    err.statusCode = 400;
    throw err;
  }

  // Fetch target report
  const targetReport = await getReport(sessionId, version);

  const updatedReport = await prisma.report.update({
    where: { id: targetReport.id },
    data: {
      finalRecommendation: newRecommendation,
      overrideReason: reason.trim(),
      overriddenBy: overriddenBy ? String(overriddenBy).trim() : 'ASSESSMENT_BOARD',
      overriddenAt: new Date(),
      boardRemarks: remarks !== null && remarks !== undefined ? String(remarks).trim() : targetReport.boardRemarks,
    },
    include: {
      candidate: {
        select: { id: true, name: true, postApplied: true, experienceLevel: true },
      },
      post: {
        select: { id: true, title: true, level: true },
      },
    },
  });

  return updatedReport;
}

/**
 * Appends or updates assessment board remarks on a session report.
 *
 * @async
 * @param {string} sessionId - Interview session ID.
 * @param {string} remarks - Board remarks text.
 * @param {number} [version=null] - Specific report version (defaults to latest).
 * @returns {Promise<object>} Updated Report entity.
 */
async function addBoardRemarks(sessionId, remarks, version = null) {
  if (!sessionId) {
    const err = new Error('sessionId is required.');
    err.statusCode = 400;
    throw err;
  }

  if (remarks === undefined || remarks === null || typeof remarks !== 'string') {
    const err = new Error('remarks is required and must be a string.');
    err.statusCode = 400;
    throw err;
  }

  const targetReport = await getReport(sessionId, version);

  const updatedReport = await prisma.report.update({
    where: { id: targetReport.id },
    data: {
      boardRemarks: remarks.trim(),
    },
    include: {
      candidate: {
        select: { id: true, name: true, postApplied: true },
      },
      post: {
        select: { id: true, title: true },
      },
    },
  });

  return updatedReport;
}

/**
 * Lists report summaries for a ranking view, filterable by postId and recommendation.
 *
 * @async
 * @param {object} [filters={}] - Filter criteria.
 * @param {string} [filters.postId] - Filter by job post ID.
 * @param {string} [filters.recommendation] - Filter by final recommendation ('SUITABLE', etc.).
 * @param {number} [filters.skip=0] - Pagination offset.
 * @param {number} [filters.take=50] - Pagination limit.
 * @returns {Promise<{
 *   total: number,
 *   reports: Array<{
 *     id: string,
 *     sessionId: string,
 *     candidateId: string,
 *     candidateName: string,
 *     postId: string,
 *     postTitle: string,
 *     overallScore: number,
 *     interviewScore: number,
 *     skillMatchPercent: number,
 *     systemRecommendation: string,
 *     finalRecommendation: string,
 *     generatedAt: Date,
 *     version: number
 *   }>
 * }>} Ranked report summaries.
 */
async function listReports({ postId, recommendation, skip = 0, take = 50 } = {}) {
  const where = {};

  if (postId && typeof postId === 'string') {
    where.postId = postId;
  }

  if (recommendation && typeof recommendation === 'string') {
    where.finalRecommendation = recommendation;
  }

  const [total, records] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      skip: Number(skip) || 0,
      take: Number(take) || 50,
      orderBy: [{ overallScore: 'desc' }, { generatedAt: 'desc' }],
      include: {
        candidate: {
          select: { id: true, name: true, postApplied: true },
        },
        post: {
          select: { id: true, title: true },
        },
      },
    }),
  ]);

  const summaries = records.map((r) => ({
    id: r.id,
    sessionId: r.sessionId,
    candidateId: r.candidateId,
    candidateName: r.candidate ? r.candidate.name : 'Unknown',
    postId: r.postId,
    postTitle: r.post ? r.post.title : 'Unknown',
    overallScore: r.overallScore,
    interviewScore: r.interviewScore,
    skillMatchPercent: r.skillMatchPercent,
    systemRecommendation: r.systemRecommendation,
    finalRecommendation: r.finalRecommendation,
    generatedAt: r.generatedAt,
    version: r.version,
  }));

  return {
    total,
    reports: summaries,
  };
}

module.exports = {
  generateReport,
  getReport,
  overrideRecommendation,
  addBoardRemarks,
  listReports,
};
