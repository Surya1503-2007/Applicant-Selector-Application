/**
 * @file embeddingMatcher.js
 * @description Swappable placeholder for dense vector embedding similarity matcher (Part 3/Future).
 * Implements the exact same interface: similarity(requiredSkill, candidateSkill) -> { score, matchType }.
 */

const { SCORES, MATCH_TYPES } = require('../config/skillMatchConfig');

/**
 * Placeholder for dense vector embedding similarity calculation.
 *
 * @param {string} requiredSkill - Name of the required post skill.
 * @param {string} candidateSkill - Name of the candidate skill.
 * @returns {Promise<{ score: number, matchType: string }>}
 */
async function similarity(requiredSkill, candidateSkill) {
  // TODO [Part 3 / Offline Embeddings]:
  // 1. Compute 384-dim or 768-dim embeddings for requiredSkill and candidateSkill using an offline ONNX model.
  // 2. Compute cosine similarity: dotProduct(v1, v2) / (norm(v1) * norm(v2)).
  // 3. Map similarity score to semantic match bands (e.g. >= 0.88 -> 'embedding-high', >= 0.70 -> 'embedding-medium').
  throw new Error('embeddingMatcher is not yet implemented. Use logicMatcher for deterministic offline evaluation.');
}

module.exports = {
  similarity,
};

