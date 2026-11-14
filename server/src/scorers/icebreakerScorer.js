/**
 * @file icebreakerScorer.js
 * @description Dedicated scorer for warm-up / ice-breaker questions in RAC DRDO Adaptive Interviews.
 * Evaluates candidate responses based on response length / word count and aspect keyword coverage.
 * Completely deterministic and explainable. Does not mutate the technical adaptive ladder.
 */

/**
 * Stop words filtered out during simple tokenization.
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'i', 'my', 'we', 'our', 'you',
]);

/**
 * Scores an icebreaker answer using word-count adequacy and aspect-keyword coverage.
 *
 * @param {object} params
 * @param {string} params.answerText - Candidate free-text response.
 * @param {string[]} [params.aspectKeywords=[]] - Target aspects defined on the ice-breaker question.
 * @param {object} [params.options={}] - Configurable thresholds.
 * @returns {{
 *   icebreakerScore: number, // 0 - 100
 *   wordCount: number,
 *   aspectCoverage: number,  // 0 - 1
 *   matchedAspects: string[],
 *   missingAspects: string[],
 *   breakdown: object
 * }}
 */
function scoreIcebreaker({ answerText = '', aspectKeywords = [], options = {} }) {
  const text = (answerText || '').trim();
  const rawWords = text.length > 0 ? text.split(/\s+/) : [];
  const wordCount = rawWords.length;

  // Word count scoring: 0-10 words -> linear up to 40%, 10-30 words -> linear up to 100%, 30+ words -> 100%
  const minWords = options.minWords || 10;
  const idealWords = options.idealWords || 30;

  let lengthScore = 0;
  if (wordCount === 0) {
    lengthScore = 0;
  } else if (wordCount < minWords) {
    lengthScore = (wordCount / minWords) * 0.5;
  } else if (wordCount < idealWords) {
    lengthScore = 0.5 + ((wordCount - minWords) / (idealWords - minWords)) * 0.5;
  } else {
    lengthScore = 1.0;
  }

  // Aspect keywords coverage
  const aspects = Array.isArray(aspectKeywords)
    ? aspectKeywords.map((a) => (typeof a === 'string' ? a.trim() : '')).filter(Boolean)
    : [];

  const lowerText = text.toLowerCase();
  const matchedAspects = [];
  const missingAspects = [];

  for (const aspect of aspects) {
    const lowerAspect = aspect.toLowerCase();
    // Substring or token match
    if (lowerText.includes(lowerAspect)) {
      matchedAspects.push(aspect);
    } else {
      missingAspects.push(aspect);
    }
  }

  let aspectCoverage = 1.0;
  if (aspects.length > 0) {
    aspectCoverage = matchedAspects.length / aspects.length;
  }

  // Combined score: 40% length adequacy + 60% aspect coverage (or 100% length if no aspects defined)
  const wLength = aspects.length > 0 ? 0.4 : 1.0;
  const wAspect = aspects.length > 0 ? 0.6 : 0.0;

  const rawScore = wLength * lengthScore + wAspect * aspectCoverage;
  const icebreakerScore = Math.round(rawScore * 100 * 100) / 100;

  return {
    icebreakerScore,
    wordCount,
    aspectCoverage: Math.round(aspectCoverage * 100) / 100,
    matchedAspects,
    missingAspects,
    breakdown: {
      wordCount,
      lengthScore: Math.round(lengthScore * 100) / 100,
      aspectCoverage: Math.round(aspectCoverage * 100) / 100,
      matchedAspects,
      missingAspects,
      totalAspects: aspects.length,
    },
  };
}

module.exports = {
  scoreIcebreaker,
};

