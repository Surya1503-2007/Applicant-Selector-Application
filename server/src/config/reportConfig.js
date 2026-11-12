/**
 * @file reportConfig.js
 * @description Centralized configuration for RAC DRDO Part 5: Session Report and Final Scoring.
 * Declares all formula weights, suitability thresholds, topic classification bands,
 * question relevancy criteria, and anti-gaming flag definitions.
 * Ensures zero magic numbers across report calculators and service pipelines.
 */

module.exports = {
  // Question difficulty weights for weighted interview score
  // interviewScore = 100 * sum(difficultyWeight * answerScore) / sum(difficultyWeight)
  DIFFICULTY_WEIGHTS: {
    EASY: 1.0,
    MEDIUM: 1.5,
    HARD: 2.0,
  },

  // Level tags excluded from scoring (unscored warm-ups)
  EXCLUDED_LEVEL_TAGS: ['ICEBREAKER'],

  // Topic classification thresholds (0 to 100 scale)
  // STRENGTH: >= 70, AVERAGE: 45 to 69.99, WEAKNESS: < 45, NOT_ASSESSED: 0 questions
  TOPIC_BANDS: {
    STRENGTH: {
      min: 70,
      label: 'STRENGTH',
      description: 'Candidate demonstrates strong mastery in this domain topic.',
    },
    AVERAGE: {
      min: 45,
      max: 69.99,
      label: 'AVERAGE',
      description: 'Candidate demonstrates acceptable competency with minor gaps.',
    },
    WEAKNESS: {
      max: 44.99,
      label: 'WEAKNESS',
      description: 'Candidate shows notable deficiency or struggling performance.',
    },
    NOT_ASSESSED: {
      label: 'NOT_ASSESSED',
      description: 'No questions from this topic were presented during interview.',
    },
  },

  // Overall suitability blending weights
  // overallScore = wSkill * skillMatchPercent + wInterview * interviewScore
  OVERALL_WEIGHTS: {
    SKILL_MATCH: 0.2,
    INTERVIEW: 0.8,
  },

  // Final suitability recommendation bands (0 to 100 scale)
  // >= 70 SUITABLE, 45-69.99 BORDERLINE, < 45 NOT_SUITABLE
  RECOMMENDATION_BANDS: {
    SUITABLE: {
      min: 70,
      label: 'SUITABLE',
      description: 'Candidate is recommended for scientific/engineering appointment.',
    },
    BORDERLINE: {
      min: 45,
      max: 69.99,
      label: 'BORDERLINE',
      description: 'Candidate meets minimum threshold; requires board deliberation.',
    },
    NOT_SUITABLE: {
      max: 44.99,
      label: 'NOT_SUITABLE',
      description: 'Candidate does not meet required competency thresholds.',
    },
  },

  // Recommendation labels enum
  RECOMMENDATIONS: {
    SUITABLE: 'SUITABLE',
    BORDERLINE: 'BORDERLINE',
    NOT_SUITABLE: 'NOT_SUITABLE',
  },

  // Early termination rules
  EARLY_TERMINATION: {
    // End reasons indicating abnormal or forced early conclusion
    TRIGGER_END_REASONS: ['CANDIDATE_STRUGGLING', 'BOARD_TERMINATED'],
    // Maximum recommendation permissible when terminated early
    MAX_RECOMMENDATION: 'BORDERLINE',
  },

  // Question relevancy scoring configuration
  // questionRelevancy = wCand * candidateFit + wPost * postFit
  QUESTION_RELEVANCY: {
    WEIGHT_CANDIDATE: 0.5,
    WEIGHT_POST: 0.5,
    DEFAULT_MAX_SKILL_WEIGHT: 5,
    // Floor below which an individual technical question is flagged as LOW_FIT_QUESTION
    LOW_FIT_FLOOR: 0.4,
    // Session-level question relevancy percentage bands (0 to 100 scale)
    BANDS: {
      HIGH: {
        min: 70,
        label: 'HIGH',
        description: 'Questions asked strongly aligned with candidate skills and post requirements.',
      },
      MEDIUM: {
        min: 40,
        max: 69.99,
        label: 'MEDIUM',
        description: 'Questions asked moderately aligned with candidate profile and post requirements.',
      },
      LOW: {
        max: 39.99,
        label: 'LOW',
        description: 'Low alignment between questions asked and candidate competencies.',
      },
    },
  },

  // Audit and anti-gaming flag identifiers
  FLAGS: {
    TOO_SHORT: 'TOO_SHORT',
    KEYWORD_STUFFING: 'KEYWORD_STUFFING',
    NO_ANSWER: 'NO_ANSWER',
    REASKED: 'REASKED',
    MANDATORY_GAP: 'MANDATORY_GAP',
    TERMINATED_EARLY: 'TERMINATED_EARLY',
    LOW_FIT_QUESTION: 'LOW_FIT_QUESTION',
  },

  // Decimal precision for rounding formatted numeric metrics
  ROUNDING_DECIMALS: 2,
};

