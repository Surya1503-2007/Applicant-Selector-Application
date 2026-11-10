/**
 * @file logicMatcher.js
 * @description Deterministic rule-based skill similarity matcher.
 * Evaluates semantic relatedness across exact, synonym/abbreviation, and token overlap tiers.
 */

const { normalizeSkill, tokenizeAndStem, getCanonicalForm } = require('../utils/skillNormalizer');
const { SCORES, MATCH_TYPES, THRESHOLDS } = require('../config/skillMatchConfig');

/**
 * Calculates Jaccard similarity coefficient between two arrays of tokens/stems.
 *
 * @param {string[]} setA - Array of stemmed tokens.
 * @param {string[]} setB - Array of stemmed tokens.
 * @returns {number} Jaccard similarity between 0.0 and 1.0.
 */
function calculateJaccardSimilarity(setA, setB) {
  if (!setA.length || !setB.length) {
    return 0.0;
  }

  const uniqueA = new Set(setA);
  const uniqueB = new Set(setB);

  let intersectionCount = 0;
  for (const item of uniqueA) {
    if (uniqueB.has(item)) {
      intersectionCount++;
    }
  }

  const unionSize = new Set([...uniqueA, ...uniqueB]).size;
  return unionSize > 0 ? intersectionCount / unionSize : 0.0;
}

/**
 * Calculates similarity between a required skill and a candidate skill.
 * Implements a 4-tier evaluation pipeline:
 * 1. Exact match (post-normalization) -> 1.0 ('exact')
 * 2. Synonym / abbreviation match -> 0.95 ('synonym')
 * 3. Token overlap (Jaccard on stems) -> scaled 0..0.85 ('partial')
 * 4. Fallback -> 0.0 ('none')
 *
 * @param {string} requiredSkill - Name of the required post skill.
 * @param {string} candidateSkill - Name of the skill reported by candidate.
 * @returns {{ score: number, matchType: string }} Evaluated similarity result.
 */
function similarity(requiredSkill, candidateSkill) {
  if (!requiredSkill || !candidateSkill) {
    return { score: SCORES.NONE, matchType: MATCH_TYPES.NONE };
  }

  const normRequired = normalizeSkill(requiredSkill);
  const normCandidate = normalizeSkill(candidateSkill);

  // 1. Exact Match (post-normalization)
  if (normRequired === normCandidate) {
    return {
      score: SCORES.EXACT,
      matchType: MATCH_TYPES.EXACT,
    };
  }

  // 2. Synonym / Abbreviation Match
  const canonRequired = getCanonicalForm(requiredSkill);
  const canonCandidate = getCanonicalForm(candidateSkill);

  if (canonRequired && canonCandidate && canonRequired === canonCandidate) {
    return {
      score: SCORES.SYNONYM,
      matchType: MATCH_TYPES.SYNONYM,
    };
  }

  // 3. Token Overlap (Jaccard on stems of canonical forms or raw normalized tokens)
  const stemsRequired = tokenizeAndStem(canonRequired || requiredSkill);
  const stemsCandidate = tokenizeAndStem(canonCandidate || candidateSkill);

  const jaccard = calculateJaccardSimilarity(stemsRequired, stemsCandidate);

  if (jaccard >= THRESHOLDS.PARTIAL_MIN_SIMILARITY) {
    // Scale Jaccard coefficient (0..1) to range [0 .. PARTIAL_MAX]
    const scaledScore = Math.round(jaccard * SCORES.PARTIAL_MAX * 100) / 100;
    return {
      score: scaledScore,
      matchType: MATCH_TYPES.PARTIAL,
    };
  }

  // 4. No Match
  return {
    score: SCORES.NONE,
    matchType: MATCH_TYPES.NONE,
  };
}

module.exports = {
  similarity,
  calculateJaccardSimilarity,
};

