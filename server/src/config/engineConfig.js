/**
 * @file engineConfig.js
 * @description Centralized configuration for the RAC DRDO Adaptive Interview Engine (Part 4).
 * All phase transitions, question caps, difficulty progression ladders, and stop conditions
 * are declared here. Zero magic numbers in engine logic.
 */

module.exports = {
  // Interview phases
  PHASES: {
    ICEBREAKER: 'ICEBREAKER',
    TECHNICAL: 'TECHNICAL',
    COMPLETED: 'COMPLETED',
  },

  // State machine transition actions
  ACTIONS: {
    NEXT_HARDER: 'NEXT_HARDER',
    NEXT_SAME: 'NEXT_SAME',
    NEXT_EASIER: 'NEXT_EASIER',
    REASK_SIMPLIFIED: 'REASK_SIMPLIFIED',
    NEXT_TOPIC: 'NEXT_TOPIC',
    ICEBREAKER: 'ICEBREAKER',
    END: 'END',
  },

  // Reasons recorded when interview completes or terminates
  END_REASONS: {
    MAX_QUESTIONS_REACHED: 'MAX_QUESTIONS_REACHED',
    ALL_TOPICS_FINISHED: 'ALL_TOPICS_FINISHED',
    CANDIDATE_STRUGGLING: 'CANDIDATE_STRUGGLING',
    POOL_EXHAUSTED: 'POOL_EXHAUSTED',
    BOARD_TERMINATED: 'BOARD_TERMINATED',
  },

  // Interview progression limits & caps
  LIMITS: {
    // Number of warm-up icebreakers to ask before technical ladder
    ICEBREAKER_COUNT: 2,

    // Maximum technical questions before auto-completing interview
    MAX_TECHNICAL_QUESTIONS: 10,

    // Consecutive IRRELEVANT answers triggering early exit (CANDIDATE_STRUGGLING)
    CONSECUTIVE_IRRELEVANT_LIMIT: 3,

    // Maximum questions per difficulty within a single topic
    MAX_EASY_PER_TOPIC: 2,
    MAX_MEDIUM_PER_TOPIC: 2,
    MAX_HARD_PER_TOPIC: 1,

    // Maximum total questions per topic before moving to next topic
    MAX_PER_TOPIC_TOTAL: 4,
  },

  // Question difficulty tiers
  DIFFICULTIES: {
    EASY: 'EASY',
    MEDIUM: 'MEDIUM',
    HARD: 'HARD',
  },

  // Ordered progression ladder
  DIFFICULTY_LADDER: ['EASY', 'MEDIUM', 'HARD'],
};

