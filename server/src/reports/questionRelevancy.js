/**
 * @file questionRelevancy.js
 * @description Question-relevancy evaluation module for RAC DRDO adaptive interviews (Part 5).
 * Computes how well the technical questions asked match the candidate's verified skills
 * and the job post's required competencies, using Part 2 logicMatcher.
 * Completely swappable for future embedding/expert-typed question engines (Part 7).
 */

const defaultMatcher = require('../matchers/logicMatcher');
const defaultConfig = require('../config/reportConfig');

/**
 * Normalizes a list of candidate skills into uniform string skill names.
 *
 * @param {Array<string|object>} candidateSkills - Raw candidate skill entries.
 * @returns {string[]} Clean, non-empty skill name strings.
 */
function normalizeCandidateSkills(candidateSkills) {
  if (!Array.isArray(candidateSkills)) return [];
  return candidateSkills
    .map((s) => (typeof s === 'string' ? s : s && s.skillName ? s.skillName : ''))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Normalizes a list of post skills into uniform objects with skillName and weight.
 *
 * @param {Array<string|object>} postSkills - Raw post skill entries.
 * @returns {Array<{ skillName: string, weight: number }>} Normalized post skill list.
 */
function normalizePostSkills(postSkills) {
  if (!Array.isArray(postSkills)) return [];
  return postSkills
    .map((p) => {
      if (typeof p === 'string') {
        return { skillName: p.trim(), weight: 1 };
      }
      return {
        skillName: (p.skillName || '').trim(),
        weight: Number(p.weight) > 0 ? Number(p.weight) : 1,
      };
    })
    .filter((p) => p.skillName.length > 0);
}

/**
 * Extracts searchable keywords plus the topic name from a question entity.
 *
 * @param {object} question - Question entity or data object.
 * @returns {string[]} Array of search items (keywords + topic name).
 */
function extractQuestionItems(question) {
  if (!question) return [];

  const rawKeywords = Array.isArray(question.keywords) ? question.keywords : [];
  const items = rawKeywords
    .map((k) => (typeof k === 'string' ? k.trim() : ''))
    .filter((k) => k.length > 0);

  let topicName = '';
  if (question.topic && typeof question.topic === 'object' && question.topic.name) {
    topicName = question.topic.name.trim();
  } else if (typeof question.topicName === 'string') {
    topicName = question.topicName.trim();
  } else if (typeof question.topic === 'string') {
    topicName = question.topic.trim();
  }

  if (topicName && !items.some((item) => item.toLowerCase() === topicName.toLowerCase())) {
    items.push(topicName);
  }

  return items;
}

/**
 * Evaluates candidate fit and post fit for a single technical question.
 *
 * candidateFit = average over question keywords (+ topic name) of the best similarity
 *                against candidate's skills list (0..1).
 * postFit = average over question keywords (+ topic name) of the best similarity
 *           against post's required skills list (weight-adjusted by skill weight) (0..1).
 * questionRelevancy = wCand * candidateFit + wPost * postFit (0..1).
 *
 * @param {object} params - Input parameters.
 * @param {object} params.question - Question entity (keywords, topic/topicName, etc.).
 * @param {Array<string|object>} [params.candidateSkills=[]] - Candidate skills.
 * @param {Array<string|object>} [params.postSkills=[]] - Post required skills.
 * @param {object} [params.config=defaultConfig] - Report configuration overrides.
 * @param {object} [params.matcher=defaultMatcher] - Swappable similarity matcher.
 * @returns {{
 *   candidateFit: number,
 *   postFit: number,
 *   questionRelevancy: number,
 *   isLowFit: boolean,
 *   breakdown: {
 *     items: string[],
 *     candidateMatches: Array<{ item: string, bestSkill: string|null, score: number }>,
 *     postMatches: Array<{ item: string, bestSkill: string|null, score: number, weightedScore: number }>
 *   }
 * }} Detailed relevancy assessment for the question.
 */
function scoreQuestionRelevancy({
  question,
  candidateSkills = [],
  postSkills = [],
  config = defaultConfig,
  matcher = defaultMatcher,
}) {
  const relConfig = config.QUESTION_RELEVANCY || defaultConfig.QUESTION_RELEVANCY;
  const wCand = relConfig.WEIGHT_CANDIDATE ?? 0.5;
  const wPost = relConfig.WEIGHT_POST ?? 0.5;
  const lowFitFloor = relConfig.LOW_FIT_FLOOR ?? 0.4;

  const items = extractQuestionItems(question);
  const candSkills = normalizeCandidateSkills(candidateSkills);
  const pSkills = normalizePostSkills(postSkills);

  if (items.length === 0) {
    return {
      candidateFit: 0.0,
      postFit: 0.0,
      questionRelevancy: 0.0,
      isLowFit: true,
      breakdown: { items: [], candidateMatches: [], postMatches: [] },
    };
  }

  // 1. Candidate Fit
  const candidateMatches = [];
  let totalCandScore = 0;

  for (const item of items) {
    let bestScore = 0.0;
    let bestSkill = null;

    for (const cSkill of candSkills) {
      const match = matcher.similarity(item, cSkill);
      if (match.score > bestScore) {
        bestScore = match.score;
        bestSkill = cSkill;
      }
    }

    totalCandScore += bestScore;
    candidateMatches.push({ item, bestSkill, score: bestScore });
  }

  const candidateFit = candSkills.length > 0 ? totalCandScore / items.length : 0.0;

  // 2. Post Fit (weight-adjusted by skill weight)
  const postMatches = [];
  let totalPostScore = 0;
  const maxConfigWeight = relConfig.DEFAULT_MAX_SKILL_WEIGHT || 5;
  const maxWeight = Math.max(
    ...pSkills.map((p) => p.weight),
    maxConfigWeight
  );

  for (const item of items) {
    let bestWeightedScore = 0.0;
    let bestRawScore = 0.0;
    let bestSkill = null;

    for (const pSkill of pSkills) {
      const match = matcher.similarity(item, pSkill.skillName);
      const weightFactor = maxWeight > 0 ? pSkill.weight / maxWeight : 1.0;
      const weighted = match.score * weightFactor;

      if (weighted > bestWeightedScore) {
        bestWeightedScore = weighted;
        bestRawScore = match.score;
        bestSkill = pSkill.skillName;
      }
    }

    totalPostScore += bestWeightedScore;
    postMatches.push({
      item,
      bestSkill,
      score: bestRawScore,
      weightedScore: bestWeightedScore,
    });
  }

  const postFit = pSkills.length > 0 ? totalPostScore / items.length : 0.0;

  // 3. Combined Question Relevancy (0..1)
  const rawRelevancy = wCand * candidateFit + wPost * postFit;
  const questionRelevancy = Math.round(rawRelevancy * 10000) / 10000;
  const isLowFit = questionRelevancy < lowFitFloor;

  return {
    candidateFit: Math.round(candidateFit * 10000) / 10000,
    postFit: Math.round(postFit * 10000) / 10000,
    questionRelevancy,
    isLowFit,
    breakdown: {
      items,
      candidateMatches,
      postMatches,
    },
  };
}

/**
 * Determines the question relevancy band from a 0-100 session-level score.
 *
 * @param {number} score - Relevancy percentage (0 to 100).
 * @param {object} [config=defaultConfig] - Report configuration.
 * @returns {string} Relevancy band ("HIGH" | "MEDIUM" | "LOW").
 */
function determineRelevancyBand(score, config = defaultConfig) {
  const bands = config.QUESTION_RELEVANCY?.BANDS || defaultConfig.QUESTION_RELEVANCY.BANDS;

  if (score >= bands.HIGH.min) {
    return bands.HIGH.label;
  }
  if (score >= bands.MEDIUM.min) {
    return bands.MEDIUM.label;
  }
  return bands.LOW.label;
}

/**
 * Calculates session-level aggregate question relevancy score and band across all asked technical questions.
 *
 * @param {Array<{ questionRelevancy: number, difficulty?: string }>} relevancyList - Evaluated technical questions.
 * @param {object} [config=defaultConfig] - Report configuration.
 * @returns {{
 *   questionRelevancyScore: number,
 *   questionRelevancyBand: string,
 *   lowFitCount: number,
 *   totalEvaluated: number
 * }} Aggregated session relevancy metrics.
 */
function computeSessionQuestionRelevancy(relevancyList, config = defaultConfig) {
  const relConfig = config.QUESTION_RELEVANCY || defaultConfig.QUESTION_RELEVANCY;
  const lowFitFloor = relConfig.LOW_FIT_FLOOR ?? 0.4;

  if (!Array.isArray(relevancyList) || relevancyList.length === 0) {
    return {
      questionRelevancyScore: 0.0,
      questionRelevancyBand: determineRelevancyBand(0, config),
      lowFitCount: 0,
      totalEvaluated: 0,
    };
  }

  let totalRelevancy = 0;
  let lowFitCount = 0;

  for (const item of relevancyList) {
    const val = typeof item === 'number' ? item : item.questionRelevancy || 0;
    totalRelevancy += val;
    if (val < lowFitFloor) {
      lowFitCount++;
    }
  }

  const averageRelevancy = totalRelevancy / relevancyList.length;
  const scorePercent = Math.round(averageRelevancy * 100 * 100) / 100;
  const questionRelevancyBand = determineRelevancyBand(scorePercent, config);

  return {
    questionRelevancyScore: scorePercent,
    questionRelevancyBand,
    lowFitCount,
    totalEvaluated: relevancyList.length,
  };
}

module.exports = {
  scoreQuestionRelevancy,
  determineRelevancyBand,
  computeSessionQuestionRelevancy,
  normalizeCandidateSkills,
  normalizePostSkills,
  extractQuestionItems,
};

