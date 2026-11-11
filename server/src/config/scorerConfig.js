/**
 * @file scorerConfig.js
 * @description Centralized configuration for Part 3 Answer Scorer weights, thresholds,
 * verdict bands, and anti-gaming parameters. Zero magic numbers in scoring logic.
 */

module.exports = {
  // Active scorer engine ('logic' | 'embedding')
  ACTIVE_SCORER: process.env.ANSWER_SCORER || 'logic',

  // Blend weights for relevancy, correctness, and final answerScore
  SCORING_WEIGHTS: {
    RELEVANCY: {
      topicOverlap: 0.5,
      questionSimilarity: 0.2,
      idealAnswerSimilarity: 0.3,
    },
    CORRECTNESS: {
      keywordCoverage: 0.65,
      idealAnswerSimilarity: 0.35,
    },
    ANSWER_SCORE: {
      relevancy: 0.4,
      correctness: 0.6,
    },
  },

  // Topic-vocabulary overlap blend between precision (answer focus) and recall (topic breadth)
  TOPIC_OVERLAP: {
    PRECISION_WEIGHT: 0.75,
    RECALL_WEIGHT: 0.25,
  },

  // Verdict thresholds on final answerScore (0..1)
  // < 0.35 -> IRRELEVANT, 0.35..0.70 -> PARTIAL, > 0.70 -> STRONG
  VERDICT_THRESHOLDS: {
    IRRELEVANT_MAX: 0.35,
    STRONG_MIN: 0.7,
  },

  // Verdict labels
  VERDICTS: {
    IRRELEVANT: 'IRRELEVANT',
    PARTIAL: 'PARTIAL',
    STRONG: 'STRONG',
    NOT_SCORED: 'NOT_SCORED',
  },

  // Diagnostic and anti-gaming flags
  FLAGS: {
    NO_ANSWER: 'NO_ANSWER',
    TOO_SHORT: 'TOO_SHORT',
    KEYWORD_STUFFING: 'KEYWORD_STUFFING',
    OFF_TOPIC: 'OFF_TOPIC',
    LONG_ANSWER_CAPPED: 'LONG_ANSWER_CAPPED',
    NOT_SCORED: 'NOT_SCORED',
  },

  // TF-IDF weighting parameters
  TFIDF: {
    SUBLINEAR_TF: true,
    MAX_TF_WEIGHT: 3.0,
    DEFAULT_IDF_UNINITIALIZED: 1.0,
    DEFAULT_IDF_OOV: 1.0,
  },

  // Keyword coverage matching parameters
  KEYWORD_MATCHING: {
    FULL_MATCH_CREDIT: 1.0,
    PARTIAL_CREDIT_FACTOR: 0.8,
    PARTIAL_MIN_CREDIT: 0.25,
  },

  // Anti-gaming and edge-case rules
  ANTI_GAMING: {
    NO_ANSWER_PHRASES: [
      'i don t know',
      'i do not know',
      'dont know',
      'don t know',
      'idk',
      'no idea',
      'i have no idea',
      'pass',
      'skip',
      'na',
      'n a',
      'none',
      'nothing',
      'not sure',
      'i am not sure',
      'no clue',
      'cannot answer',
      'can t answer',
      'no comment',
    ],
    MIN_WORD_COUNT: 6,
    TOO_SHORT_MAX_RELEVANCY: 0.35,
    TOO_SHORT_MAX_CORRECTNESS: 0.25,
    TOO_SHORT_MAX_SCORE: 0.3,
    MAX_ANSWER_WORDS: 250,
    KEYWORD_STUFFING: {
      MIN_STOPWORD_RATIO: 0.14,
      LIST_MAX_STOPWORD_RATIO: 0.22,
      HIGH_COMMA_RATIO: 0.2,
      HIGH_DENSITY_THRESHOLD: 0.5,
      MIN_MATCHED_KEYWORDS: 2,
      MIN_UNIQUE_STEM_RATIO: 0.45,
      PENALTY_MULTIPLIER: 0.45,
      MAX_SCORE: 0.45,
    },
    OFF_TOPIC: {
      MIN_TOPIC_OVERLAP: 0.15,
      MAX_RELEVANCY: 0.15,
      MAX_SCORE: 0.28,
    },
  },

  // Numeric score rounding precision (decimal digits)
  ROUNDING_DECIMALS: 4,
};
