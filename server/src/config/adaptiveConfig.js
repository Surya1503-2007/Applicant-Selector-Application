/**
 * @file adaptiveConfig.js
 * @description Centralized configuration for the RAC DRDO Adaptive Interview Engine & Answer Scorer.
 * Eliminates magic numbers across answer scoring, difficulty transitions, and question selection.
 */

module.exports = {
  // Thresholds for answer relevancy score (0.0 to 1.0)
  RELEVANCY_THRESHOLDS: {
    // Score >= HIGH triggers promotion to higher difficulty or follow-up question
    HIGH: 0.75,
    // Score >= MODERATE but < HIGH maintains current difficulty
    MODERATE: 0.45,
    // Score < LOW triggers demotion to easier difficulty
    LOW: 0.45,
  },

  // Weightings for scoring components
  SCORING_WEIGHTS: {
    // Weight of keyword/concept coverage in relevancy
    RELEVANCY_KEYWORD_WEIGHT: 0.65,
    // Weight of semantic similarity with ideal answer in relevancy
    RELEVANCY_SEMANTIC_WEIGHT: 0.35,

    // Weight of keyword coverage in correctness
    CORRECTNESS_KEYWORD_WEIGHT: 0.55,
    // Weight of technical assertion alignment in correctness
    CORRECTNESS_SEMANTIC_WEIGHT: 0.45,
  },

  // Transition actions
  TRANSITIONS: {
    FOLLOW_UP_UNLOCKED: 'FOLLOW_UP_UNLOCKED',
    STEP_UP: 'STEP_UP',
    MAINTAIN: 'MAINTAIN',
    STEP_DOWN: 'STEP_DOWN',
  },

  // Interview session progression rules
  INTERVIEW_RULES: {
    // Maximum questions per interview session
    MAX_QUESTIONS_PER_SESSION: 6,
    // Default initial difficulty for technical questions
    INITIAL_DIFFICULTY: 'EASY',
    // Whether to start with an icebreaker question
    INCLUDE_ICEBREAKER: true,
  },

  // Stop words to filter out during semantic stem analysis
  STOP_WORDS: new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
    'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
    'will', 'with', 'we', 'they', 'this', 'these', 'those', 'or', 'so', 'can',
    'could', 'should', 'would', 'into', 'such', 'than', 'more', 'most', 'some',
  ]),
};

