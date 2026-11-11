/**
 * @file embeddingScorer.js
 * @description Swappable placeholder for dense vector embedding answer scorer (future upgrade).
 * Implements the exact same interface as logicScorer.js:
 * scoreAnswer({ question, answerText }) -> Promise<{ relevancy, correctness, answerScore, verdict, breakdown }>.
 */

/**
 * Placeholder for dense semantic embedding-based answer evaluation.
 *
 * @async
 * @param {{ question: object, answerText: string }} params - Question record and candidate free-text answer.
 * @returns {Promise<{
 *   relevancy: number,
 *   correctness: number,
 *   answerScore: number,
 *   verdict: string,
 *   breakdown: object
 * }>}
 */
async function scoreAnswer({ question, answerText }) {
  // TODO [Future / Offline Semantic Embeddings]:
  // 1. Load local sentence-transformer ONNX model (e.g., all-MiniLM-L6-v2) with zero external API calls.
  // 2. Encode question.questionText, question.idealAnswer, and answerText into dense 384-dim embeddings.
  // 3. Compute cosine similarities for questionSimilarity and idealAnswerSimilarity.
  // 4. Combine semantic similarity with keyword coverage and anti-gaming rules from scorerConfig.js.
  void question;
  void answerText;
  throw new Error(
    'embeddingScorer is not yet implemented. Set ACTIVE_SCORER="logic" in scorerConfig.js for deterministic offline scoring.'
  );
}

/**
 * Placeholder for refreshing corpus statistics or embedding caches.
 *
 * @async
 * @returns {Promise<{ initialized: boolean, note: string }>}
 */
async function refreshIdf() {
  return {
    initialized: false,
    note: 'embeddingScorer does not use TF-IDF caching.',
  };
}

/**
 * Placeholder for lazy initialization hook matching logicScorer interface.
 *
 * @async
 * @returns {Promise<void>}
 */
async function ensureIdfLoaded() {
  return Promise.resolve();
}

module.exports = {
  scoreAnswer,
  refreshIdf,
  ensureIdfLoaded,
};

