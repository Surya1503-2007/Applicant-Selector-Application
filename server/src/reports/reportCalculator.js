/**
 * @file reportCalculator.js
 * @description Pure calculation functions for RAC DRDO Part 5: Session Report and Final Scoring.
 * Contains ZERO database access or network I/O.
 * All logic is purely functional, deterministic, fully explainable, and traceable.
 */

const defaultConfig = require('../config/reportConfig');

/**
 * Difficulty rank map used to compare difficulty levels.
 */
const DIFFICULTY_RANK = {
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
};

/**
 * Extracts difficulty from a response object supporting nested or flat shapes.
 *
 * @param {object} response - Candidate response item.
 * @returns {string} Difficulty string ('EASY', 'MEDIUM', 'HARD') or 'EASY' fallback.
 */
function getResponseDifficulty(response) {
  if (response.difficulty) return response.difficulty;
  if (response.question && response.question.difficulty) return response.question.difficulty;
  return 'EASY';
}

/**
 * Extracts levelTag from a response object supporting nested or flat shapes.
 *
 * @param {object} response - Candidate response item.
 * @returns {string} Level tag string ('TECHNICAL', 'ICEBREAKER', etc.).
 */
function getResponseLevelTag(response) {
  if (response.levelTag) return response.levelTag;
  if (response.question && response.question.levelTag) return response.question.levelTag;
  return 'TECHNICAL';
}

/**
 * Extracts topic ID from a response object.
 *
 * @param {object} response - Candidate response item.
 * @returns {string|null} Topic identifier.
 */
function getResponseTopicId(response) {
  if (response.topicId) return response.topicId;
  if (response.question) {
    if (response.question.topicId) return response.question.topicId;
    if (response.question.topic && response.question.topic.id) return response.question.topic.id;
  }
  return null;
}

/**
 * Filters responses to only the final attempt for each technical question.
 * Icebreaker questions are excluded.
 * When a question was asked normally and then re-asked, only the final attempt (isReask=true) counts.
 *
 * @param {Array<object>} responses - Chronological candidate responses.
 * @param {object} [config=defaultConfig] - Report configuration.
 * @returns {Array<object>} Final-attempt technical responses.
 */
function getFinalTechnicalResponses(responses, config = defaultConfig) {
  if (!Array.isArray(responses) || responses.length === 0) {
    return [];
  }

  const excludedTags = new Set(config.EXCLUDED_LEVEL_TAGS || defaultConfig.EXCLUDED_LEVEL_TAGS);

  // Filter to technical questions only
  const technicalResponses = responses.filter((r) => {
    const levelTag = getResponseLevelTag(r);
    return !excludedTags.has(levelTag);
  });

  // Group by questionId preserving the last response as the final attempt
  const finalMap = new Map();
  for (const resp of technicalResponses) {
    const qId = resp.questionId || (resp.question && resp.question.id);
    if (!qId) continue;

    // If already in map, a later response or isReask=true supersedes previous
    if (!finalMap.has(qId)) {
      finalMap.set(qId, resp);
    } else {
      const existing = finalMap.get(qId);
      // Prefer explicit isReask === true as the final attempt
      if (resp.isReask && !existing.isReask) {
        finalMap.set(qId, resp);
      } else {
        // Otherwise, subsequent response in chronological order is final attempt
        finalMap.set(qId, resp);
      }
    }
  }

  return Array.from(finalMap.values());
}

/**
 * Computes the weighted technical interview score (0 to 100).
 *
 * Rules:
 * - Only TECHNICAL questions count; ICEBREAKER questions are excluded.
 * - Re-asked questions: only the FINAL attempt counts; prior attempts are excluded from score.
 * - Formula: interviewScore = 100 * sum(difficultyWeight * answerScore) / sum(difficultyWeight).
 * - Avoids division by zero (returns 0.0 when no technical questions exist).
 *
 * @param {Array<object>} responses - All candidate responses from the session.
 * @param {object} [config=defaultConfig] - Report configuration.
 * @returns {number} Weighted interview score (0.0 to 100.0).
 */
function computeInterviewScore(responses, config = defaultConfig) {
  const finalResponses = getFinalTechnicalResponses(responses, config);

  if (finalResponses.length === 0) {
    return 0.0;
  }

  const diffWeights = config.DIFFICULTY_WEIGHTS || defaultConfig.DIFFICULTY_WEIGHTS;
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const resp of finalResponses) {
    const diff = getResponseDifficulty(resp);
    const weight = diffWeights[diff] !== undefined ? diffWeights[diff] : 1.0;
    const score = typeof resp.answerScore === 'number' ? resp.answerScore : 0.0;

    totalWeightedScore += weight * score;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return 0.0;
  }

  const rawScore = (totalWeightedScore / totalWeight) * 100;
  const decimals = config.ROUNDING_DECIMALS ?? 2;
  const factor = Math.pow(10, decimals);
  return Math.round(rawScore * factor) / factor;
}

/**
 * Evaluates the performance label for a given topic score.
 *
 * Thresholds:
 * - >= 70: 'STRENGTH'
 * - 45 to 69.99: 'AVERAGE'
 * - < 45: 'WEAKNESS'
 *
 * @param {number|null} score - Calculated topic percentage score (0 to 100).
 * @param {object} [config=defaultConfig] - Report configuration.
 * @returns {string} Performance label ('STRENGTH' | 'AVERAGE' | 'WEAKNESS' | 'NOT_ASSESSED').
 */
function determineTopicLabel(score, config = defaultConfig) {
  if (score === null || score === undefined) {
    return config.TOPIC_BANDS?.NOT_ASSESSED?.label || 'NOT_ASSESSED';
  }

  const bands = config.TOPIC_BANDS || defaultConfig.TOPIC_BANDS;

  if (score >= bands.STRENGTH.min) {
    return bands.STRENGTH.label;
  }
  if (score >= bands.AVERAGE.min) {
    return bands.AVERAGE.label;
  }
  return bands.WEAKNESS.label;
}

/**
 * Computes topic-wise performance breakdowns across all subject topics.
 *
 * Per topic:
 * - Weighted score: 100 * sum(w * s) / sum(w) for final attempts in that topic.
 * - Number of questions asked in that topic.
 * - Highest difficulty reached ('EASY', 'MEDIUM', 'HARD', or null).
 * - Highest difficulty answered STRONG (highest difficulty where verdict === 'STRONG', or null).
 * - Performance label: STRENGTH (>=70), AVERAGE (45-69.99), WEAKNESS (<45), or NOT_ASSESSED (0 questions).
 *
 * @param {Array<object>} responses - All candidate responses.
 * @param {Array<object>} topics - All available topics for the evaluated subject [{ id, name }].
 * @param {object} [config=defaultConfig] - Report configuration.
 * @returns {Array<{
 *   topicId: string,
 *   topicName: string,
 *   score: number|null,
 *   questionsCount: number,
 *   highestDifficultyReached: string|null,
 *   highestDifficultyStrong: string|null,
 *   label: string
 * }>} Topic-wise evaluation table.
 */
function computeTopicScores(responses, topics = [], config = defaultConfig) {
  const diffWeights = config.DIFFICULTY_WEIGHTS || defaultConfig.DIFFICULTY_WEIGHTS;
  const excludedTags = new Set(config.EXCLUDED_LEVEL_TAGS || defaultConfig.EXCLUDED_LEVEL_TAGS);

  // Group all technical responses by topicId
  const topicResponsesMap = new Map();
  for (const t of topics) {
    topicResponsesMap.set(t.id, []);
  }

  // Also catch any topics present in responses not in topics array
  for (const resp of responses || []) {
    const levelTag = getResponseLevelTag(resp);
    if (excludedTags.has(levelTag)) continue;

    const tid = getResponseTopicId(resp);
    if (!tid) continue;

    if (!topicResponsesMap.has(tid)) {
      topicResponsesMap.set(tid, []);
    }
    topicResponsesMap.get(tid).push(resp);
  }

  const topicResults = [];

  for (const [topicId, respList] of topicResponsesMap.entries()) {
    // Find matching topic metadata
    const topicMeta = topics.find((t) => t.id === topicId) || { id: topicId, name: topicId };

    if (respList.length === 0) {
      topicResults.push({
        topicId,
        topicName: topicMeta.name,
        score: null,
        questionsCount: 0,
        highestDifficultyReached: null,
        highestDifficultyStrong: null,
        label: determineTopicLabel(null, config),
      });
      continue;
    }

    // Filter to final attempts for score calculation
    const finalResponses = getFinalTechnicalResponses(respList, config);

    let totalWeightedScore = 0;
    let totalWeight = 0;
    let highestDiffRank = 0;
    let highestDiffReached = null;
    let highestStrongRank = 0;
    let highestDiffStrong = null;

    // Track highest difficulty across ALL asked questions in this topic
    for (const r of respList) {
      const diff = getResponseDifficulty(r);
      const rank = DIFFICULTY_RANK[diff] || 1;
      if (rank > highestDiffRank) {
        highestDiffRank = rank;
        highestDiffReached = diff;
      }

      if (r.verdict === 'STRONG' && rank > highestStrongRank) {
        highestStrongRank = rank;
        highestDiffStrong = diff;
      }
    }

    // Compute weighted score using final attempts only
    for (const r of finalResponses) {
      const diff = getResponseDifficulty(r);
      const weight = diffWeights[diff] !== undefined ? diffWeights[diff] : 1.0;
      const score = typeof r.answerScore === 'number' ? r.answerScore : 0.0;

      totalWeightedScore += weight * score;
      totalWeight += weight;
    }

    let topicScore = 0.0;
    if (totalWeight > 0) {
      const raw = (totalWeightedScore / totalWeight) * 100;
      const decimals = config.ROUNDING_DECIMALS ?? 2;
      const factor = Math.pow(10, decimals);
      topicScore = Math.round(raw * factor) / factor;
    }

    const label = determineTopicLabel(topicScore, config);

    topicResults.push({
      topicId,
      topicName: topicMeta.name,
      score: topicScore,
      questionsCount: respList.length,
      highestDifficultyReached: highestDiffReached,
      highestDifficultyStrong: highestDiffStrong,
      label,
    });
  }

  return topicResults;
}

/**
 * Computes chronological difficulty progression audit trail.
 *
 * @param {Array<object>} responses - Chronologically ordered session responses.
 * @returns {Array<{
 *   step: number,
 *   questionId: string,
 *   difficulty: string,
 *   verdict: string|null,
 *   isReask: boolean,
 *   answerScore: number|null
 * }>} Chronological difficulty trace.
 */
function computeDifficultyProgression(responses) {
  if (!Array.isArray(responses) || responses.length === 0) {
    return [];
  }

  return responses.map((resp, index) => {
    const qId = resp.questionId || (resp.question && resp.question.id) || null;
    const diff = getResponseDifficulty(resp);
    const verdict = resp.verdict || null;
    const isReask = Boolean(resp.isReask);
    const answerScore = typeof resp.answerScore === 'number' ? resp.answerScore : null;

    return {
      step: index + 1,
      questionId: qId,
      difficulty: diff,
      verdict,
      isReask,
      answerScore,
    };
  });
}

/**
 * Blends skill-match percentage and weighted interview score into overall suitability score.
 *
 * Formula:
 * overallScore = wSkill * skillMatchPercent + wInterview * interviewScore
 * Default weights: 0.20 skillMatch + 0.80 interviewScore.
 * Mandatory-skill gaps do NOT modify this mathematical score.
 *
 * @param {number} skillMatchPercent - Skill-match suitability percentage (0 to 100).
 * @param {number} interviewScore - Weighted technical interview score (0 to 100).
 * @param {object} [config=defaultConfig] - Report configuration.
 * @returns {number} Blended overall score rounded to config precision (0 to 100).
 */
function computeOverall(skillMatchPercent, interviewScore, config = defaultConfig) {
  const weights = config.OVERALL_WEIGHTS || defaultConfig.OVERALL_WEIGHTS;
  const wSkill = weights.SKILL_MATCH ?? 0.2;
  const wInterview = weights.INTERVIEW ?? 0.8;

  const sm = typeof skillMatchPercent === 'number' ? skillMatchPercent : 0.0;
  const iv = typeof interviewScore === 'number' ? interviewScore : 0.0;

  const rawOverall = wSkill * sm + wInterview * iv;
  const decimals = config.ROUNDING_DECIMALS ?? 2;
  const factor = Math.pow(10, decimals);
  return Math.round(rawOverall * factor) / factor;
}

/**
 * Computes the system suitability recommendation based on overall score and early termination status.
 *
 * Standard bands:
 * - >= 70: 'SUITABLE'
 * - 45 to 69.99: 'BORDERLINE'
 * - < 45: 'NOT_SUITABLE'
 *
 * Early termination rule:
 * - If terminatedEarly is true, the recommendation is capped at 'BORDERLINE' (never 'SUITABLE').
 *
 * @param {number} overallScore - Blended overall score (0 to 100).
 * @param {object} options - Evaluation options.
 * @param {boolean} [options.terminatedEarly=false] - Whether interview concluded prematurely.
 * @param {object} [config=defaultConfig] - Report configuration.
 * @returns {string} System recommendation ('SUITABLE' | 'BORDERLINE' | 'NOT_SUITABLE').
 */
function recommend(overallScore, { terminatedEarly = false } = {}, config = defaultConfig) {
  const bands = config.RECOMMENDATION_BANDS || defaultConfig.RECOMMENDATION_BANDS;
  const score = typeof overallScore === 'number' ? overallScore : 0.0;

  let baseRecommendation = bands.NOT_SUITABLE.label;

  if (score >= bands.SUITABLE.min) {
    baseRecommendation = bands.SUITABLE.label;
  } else if (score >= bands.BORDERLINE.min) {
    baseRecommendation = bands.BORDERLINE.label;
  }

  // Early termination cap
  if (terminatedEarly) {
    const maxRec = config.EARLY_TERMINATION?.MAX_RECOMMENDATION || 'BORDERLINE';
    if (baseRecommendation === bands.SUITABLE.label) {
      return maxRec;
    }
  }

  return baseRecommendation;
}

/**
 * Collects and aggregates all session diagnostic and anti-gaming flags into an explainable summary.
 *
 * Counts and checks:
 * - TOO_SHORT: responses with TOO_SHORT flag
 * - KEYWORD_STUFFING: responses with KEYWORD_STUFFING flag
 * - NO_ANSWER: responses with NO_ANSWER flag
 * - REASKED: count of re-asked responses
 * - MANDATORY_GAP: whether candidate lacks mandatory post skills
 * - TERMINATED_EARLY: whether session ended prematurely
 * - LOW_FIT_QUESTION: count of technical questions falling below relevancy floor
 *
 * @param {Array<object>} responses - Session responses with scoring breakdowns.
 * @param {object|null} skillMatch - Part 2 skill-match result.
 * @param {object|null} sessionState - Part 4 SessionState entity.
 * @param {object} [options={}] - Additional flag inputs (e.g. lowFitQuestionsCount).
 * @returns {{
 *   counts: {
 *     TOO_SHORT: number,
 *     KEYWORD_STUFFING: number,
 *     NO_ANSWER: number,
 *     REASKED: number,
 *     LOW_FIT_QUESTION: number
 *   },
 *   mandatoryGap: boolean,
 *   terminatedEarly: boolean,
 *   activeFlags: string[],
 *   summaryText: string
 * }} Consolidated flags audit snapshot.
 */
function collectFlags(responses = [], skillMatch = null, sessionState = null, options = {}) {
  const counts = {
    TOO_SHORT: 0,
    KEYWORD_STUFFING: 0,
    NO_ANSWER: 0,
    REASKED: 0,
    LOW_FIT_QUESTION: options.lowFitQuestionsCount || 0,
    EXPERT_INJECTED: 0,
  };

  for (const resp of responses) {
    if (resp.isReask) {
      counts.REASKED++;
    }

    const breakdownFlags =
      resp.breakdown && Array.isArray(resp.breakdown.flags)
        ? resp.breakdown.flags
        : [];

    if (breakdownFlags.includes('TOO_SHORT') || resp.verdict === 'TOO_SHORT') {
      counts.TOO_SHORT++;
    }
    if (breakdownFlags.includes('KEYWORD_STUFFING')) {
      counts.KEYWORD_STUFFING++;
    }
    if (breakdownFlags.includes('NO_ANSWER')) {
      counts.NO_ANSWER++;
    }
    if (breakdownFlags.includes('EXPERT_INJECTED') || (resp.question && resp.question.source === 'EXPERT')) {
      counts.EXPERT_INJECTED++;
    }
  }

  const mandatoryGap = Boolean(skillMatch && skillMatch.mandatoryGap);

  // Early termination detection
  let terminatedEarly = false;
  if (options.terminatedEarly !== undefined) {
    terminatedEarly = Boolean(options.terminatedEarly);
  } else if (sessionState) {
    const earlyReasons = defaultConfig.EARLY_TERMINATION.TRIGGER_END_REASONS;
    terminatedEarly =
      earlyReasons.includes(sessionState.endReason) ||
      sessionState.status === 'TERMINATED_EARLY';
  }

  // Compile active flags list
  const activeFlags = [];
  if (counts.TOO_SHORT > 0) activeFlags.push('TOO_SHORT');
  if (counts.KEYWORD_STUFFING > 0) activeFlags.push('KEYWORD_STUFFING');
  if (counts.NO_ANSWER > 0) activeFlags.push('NO_ANSWER');
  if (counts.REASKED > 0) activeFlags.push('REASKED');
  if (counts.LOW_FIT_QUESTION > 0) activeFlags.push('LOW_FIT_QUESTION');
  if (counts.EXPERT_INJECTED > 0) activeFlags.push('EXPERT_INJECTED');
  if (mandatoryGap) activeFlags.push('MANDATORY_GAP');
  if (terminatedEarly) activeFlags.push('TERMINATED_EARLY');

  const summaryText =
    activeFlags.length === 0
      ? 'Clean session: no anomalies or anti-gaming flags triggered.'
      : `Flags detected: ${activeFlags.join(', ')}.`;

  return {
    counts,
    mandatoryGap,
    terminatedEarly,
    activeFlags,
    summaryText,
  };
}

module.exports = {
  computeInterviewScore,
  computeTopicScores,
  computeDifficultyProgression,
  computeOverall,
  recommend,
  collectFlags,
  determineTopicLabel,
  getFinalTechnicalResponses,
  getResponseDifficulty,
  getResponseLevelTag,
  getResponseTopicId,
  DIFFICULTY_RANK,
};

