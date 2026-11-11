/**
 * @file answerScorer.js
 * @description Deterministic offline NLP evaluation of candidate interview answers.
 * Evaluates relevancy and correctness by analyzing keyword coverage, domain synonyms,
 * and semantic content overlap against the question's ideal answer.
 */

const { normalizeSkill, tokenizeAndStem, getCanonicalForm } = require('../utils/skillNormalizer');
const { SCORING_WEIGHTS, STOP_WORDS } = require('../config/adaptiveConfig');

/**
 * Extracts content stems from a text string, excluding standard stop words.
 *
 * @param {string} text - Input text.
 * @returns {string[]} Array of non-stopword stemmed tokens.
 */
function extractContentStems(text) {
  if (!text || typeof text !== 'string') return [];

  const normalized = normalizeSkill(text);
  if (!normalized) return [];

  return normalized
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .map((token) => {
      // Use tokenizeAndStem from normalizer
      const stems = tokenizeAndStem(token);
      return stems.length > 0 ? stems[0] : token;
    });
}

/**
 * Checks whether a target keyword/keyphrase is present in the candidate's answer.
 * Uses exact substring, canonical synonym mapping, and token stem set overlap.
 *
 * @param {string} keyword - Required domain keyword/keyphrase.
 * @param {string} normalizedAnswer - Normalized text of candidate's answer.
 * @param {Set<string>} answerStemSet - Set of content stems from candidate's answer.
 * @returns {{ matched: boolean, credit: number, matchReason: string }}
 */
function evaluateKeywordPresence(keyword, normalizedAnswer, answerStemSet) {
  if (!keyword) {
    return { matched: false, credit: 0.0, matchReason: 'none' };
  }

  const normKeyword = normalizeSkill(keyword);
  const canonKeyword = getCanonicalForm(keyword);

  // 1. Direct substring match of normalized keyword
  if (normalizedAnswer.includes(normKeyword)) {
    return { matched: true, credit: 1.0, matchReason: 'exact_phrase' };
  }

  // 2. Canonical synonym match (e.g., candidate used abbreviation or full phrase)
  if (canonKeyword && normalizedAnswer.includes(canonKeyword)) {
    return { matched: true, credit: 1.0, matchReason: 'canonical_synonym' };
  }

  // 3. Stems intersection check
  const keywordStems = extractContentStems(keyword);
  if (keywordStems.length === 0) {
    return { matched: false, credit: 0.0, matchReason: 'empty_keyword' };
  }

  let matchedStemCount = 0;
  for (const stem of keywordStems) {
    if (answerStemSet.has(stem)) {
      matchedStemCount++;
    }
  }

  const matchRatio = matchedStemCount / keywordStems.length;

  if (matchRatio === 1.0) {
    return { matched: true, credit: 1.0, matchReason: 'all_stems_present' };
  } else if (matchRatio >= 0.5) {
    // Partial credit for multi-word phrases where majority of concepts are present
    return { matched: true, credit: Math.round(matchRatio * 0.85 * 100) / 100, matchReason: 'partial_stems' };
  }

  return { matched: false, credit: 0.0, matchReason: 'not_found' };
}

/**
 * Calculates semantic content overlap (Dice coefficient) between candidate answer and ideal answer.
 *
 * @param {string} candidateAnswer - Answer provided by candidate.
 * @param {string} idealAnswer - Target model answer.
 * @returns {number} Content overlap coefficient between 0.0 and 1.0.
 */
function calculateSemanticOverlap(candidateAnswer, idealAnswer) {
  const candidateStems = extractContentStems(candidateAnswer);
  const idealStems = extractContentStems(idealAnswer);

  if (candidateStems.length === 0 || idealStems.length === 0) {
    return 0.0;
  }

  const candSet = new Set(candidateStems);
  const idealSet = new Set(idealStems);

  let overlapCount = 0;
  for (const stem of idealSet) {
    if (candSet.has(stem)) {
      overlapCount++;
    }
  }

  // Overlap relative to ideal answer density
  const overlapRatio = overlapCount / idealSet.size;

  // Length adequacy factor (guards against 1-word matching answers)
  const lengthRatio = Math.min(candidateStems.length / Math.max(idealStems.length * 0.4, 4), 1.0);

  return Math.min(Math.round(overlapRatio * lengthRatio * 100) / 100, 1.0);
}

/**
 * Evaluates candidate response against question criteria, producing Relevancy and Correctness scores.
 *
 * @param {string} candidateAnswer - Candidate's text answer.
 * @param {object} question - Question object containing idealAnswer and keywords array.
 * @returns {{
 *   relevancyScore: number,
 *   correctnessScore: number,
 *   keywordCoverage: {
 *     total: number,
 *     matched: number,
 *     coverageRatio: number,
 *     matchedKeywords: string[],
 *     missingKeywords: string[]
 *   },
 *   semanticSimilarity: number,
 *   feedbackSummary: string
 * }}
 */
function evaluateAnswer(candidateAnswer, question) {
  if (!candidateAnswer || typeof candidateAnswer !== 'string' || candidateAnswer.trim().length === 0) {
    return {
      relevancyScore: 0.0,
      correctnessScore: 0.0,
      keywordCoverage: {
        total: (question && question.keywords) ? question.keywords.length : 0,
        matched: 0,
        coverageRatio: 0.0,
        matchedKeywords: [],
        missingKeywords: (question && question.keywords) ? [...question.keywords] : [],
      },
      semanticSimilarity: 0.0,
      feedbackSummary: 'No answer provided.',
    };
  }

  const idealAnswer = (question && question.idealAnswer) ? question.idealAnswer : '';
  const keywords = (question && Array.isArray(question.keywords)) ? question.keywords : [];

  const normalizedAnswer = normalizeSkill(candidateAnswer);
  const answerContentStems = extractContentStems(candidateAnswer);
  const answerStemSet = new Set(answerContentStems);

  // 1. Keyword Evaluation
  let totalKeywordCredit = 0.0;
  const matchedKeywords = [];
  const missingKeywords = [];

  for (const kw of keywords) {
    const result = evaluateKeywordPresence(kw, normalizedAnswer, answerStemSet);
    if (result.matched) {
      totalKeywordCredit += result.credit;
      matchedKeywords.push(kw);
    } else {
      missingKeywords.push(kw);
    }
  }

  const keywordCoverageRatio = keywords.length > 0 ? totalKeywordCredit / keywords.length : 0.5;

  // 2. Semantic Content Overlap
  const semanticSimilarity = calculateSemanticOverlap(candidateAnswer, idealAnswer);

  // 3. Compute Relevancy Score (0.0 to 1.0)
  // Relevancy measures whether the candidate addresses the core concepts and stayed on topic
  const rawRelevancy =
    SCORING_WEIGHTS.RELEVANCY_KEYWORD_WEIGHT * keywordCoverageRatio +
    SCORING_WEIGHTS.RELEVANCY_SEMANTIC_WEIGHT * semanticSimilarity;
  const relevancyScore = Math.min(Math.max(Math.round(rawRelevancy * 100) / 100, 0.0), 1.0);

  // 4. Compute Correctness Score (0.0 to 1.0)
  // Correctness measures technical depth and alignment with ideal answer propositions
  const rawCorrectness =
    SCORING_WEIGHTS.CORRECTNESS_KEYWORD_WEIGHT * keywordCoverageRatio +
    SCORING_WEIGHTS.CORRECTNESS_SEMANTIC_WEIGHT * semanticSimilarity;
  const correctnessScore = Math.min(Math.max(Math.round(rawCorrectness * 100) / 100, 0.0), 1.0);

  // 5. Generate human-readable feedback summary
  let feedbackSummary = '';
  if (relevancyScore >= 0.75) {
    feedbackSummary = 'Comprehensive and technically accurate answer with strong domain keyword alignment.';
  } else if (relevancyScore >= 0.45) {
    feedbackSummary = 'Partially relevant answer covering some core concepts, but missing key technical details.';
  } else {
    feedbackSummary = 'Answer lacks alignment with expected technical concepts and required keywords.';
  }

  return {
    relevancyScore,
    correctnessScore,
    keywordCoverage: {
      total: keywords.length,
      matched: matchedKeywords.length,
      coverageRatio: Math.round(keywordCoverageRatio * 100) / 100,
      matchedKeywords,
      missingKeywords,
    },
    semanticSimilarity,
    feedbackSummary,
  };
}

module.exports = {
  evaluateAnswer,
  evaluateKeywordPresence,
  calculateSemanticOverlap,
  extractContentStems,
};

