/**
 * @file subjectConfig.js
 * @description Configuration parameters for multi-subject domain governance and question bank balance thresholds.
 * Defines minimum question counts per difficulty per topic and subject validation rules.
 */

const SUBJECT_CONFIG = {
  /** Minimum question count required per difficulty tier within an active topic */
  MIN_QUESTIONS_PER_DIFFICULTY: {
    EASY: 1,
    MEDIUM: 1,
    HARD: 1,
  },

  /** Recommended minimum question count for balanced adaptive questioning */
  RECOMMENDED_MIN_QUESTIONS_PER_DIFFICULTY: {
    EASY: 2,
    MEDIUM: 2,
    HARD: 2,
  },

  /** Supported difficulty levels in question bank */
  DIFFICULTIES: ['EASY', 'MEDIUM', 'HARD'],

  /** Permitted level tags */
  LEVEL_TAGS: ['TECHNICAL', 'MANAGERIAL', 'ICEBREAKER'],
};

module.exports = SUBJECT_CONFIG;

