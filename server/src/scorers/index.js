/**
 * @file index.js
 * @description Scorer registry and factory selecting the active answer scorer from scorerConfig.js.
 * Swapping between deterministic logicScorer and future embeddingScorer requires only a config change.
 */

const scorerConfig = require('../config/scorerConfig');
const logicScorer = require('./logicScorer');
const embeddingScorer = require('./embeddingScorer');

const SCORER_REGISTRY = {
  logic: logicScorer,
  embedding: embeddingScorer,
};

/**
 * Retrieves a scorer module by name, defaulting to the configured ACTIVE_SCORER.
 *
 * @param {string} [name=scorerConfig.ACTIVE_SCORER] - Registered scorer identifier ('logic' | 'embedding').
 * @returns {object} Scorer module exposing scoreAnswer({ question, answerText }), refreshIdf(), ensureIdfLoaded().
 */
function getScorer(name = scorerConfig.ACTIVE_SCORER) {
  const key = typeof name === 'string' ? name.toLowerCase().trim() : '';
  const scorer = SCORER_REGISTRY[key];
  if (!scorer) {
    throw new Error(
      `Unknown answer scorer "${name}". Valid options are: ${Object.keys(SCORER_REGISTRY).join(', ')}.`
    );
  }
  return scorer;
}

const activeScorer = getScorer();

module.exports = {
  activeScorerName: scorerConfig.ACTIVE_SCORER,
  getScorer,
  scoreAnswer: (...args) => getScorer().scoreAnswer(...args),
  refreshIdf: (...args) => getScorer().refreshIdf(...args),
  ensureIdfLoaded: (...args) => getScorer().ensureIdfLoaded(...args),
  activeScorer,
};

