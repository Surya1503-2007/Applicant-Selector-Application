/**
 * @file skillMatchConfig.js
 * @description Centralized configuration for skill-matching thresholds, score tiers, and candidate suitability bands.
 * Ensures zero magic numbers across matcher engines and reporting services.
 */

module.exports = {
  // Similarity score tiers
  SCORES: {
    EXACT: 1.0,
    SYNONYM: 0.95,
    PARTIAL_MAX: 0.85,
    NONE: 0.0,
  },

  // Match classification types
  MATCH_TYPES: {
    EXACT: 'exact',
    SYNONYM: 'synonym',
    PARTIAL: 'partial',
    NONE: 'none',
  },

  // Operational thresholds
  THRESHOLDS: {
    // Minimum similarity score for a required skill to be counted as "covered"
    SKILL_COVERED: 0.5,
    // Minimum raw token Jaccard similarity required to qualify as a partial match
    PARTIAL_MIN_SIMILARITY: 0.15,
  },

  // Suitability percentage bands
  BANDS: {
    STRONG: {
      min: 70,
      label: 'STRONG',
      description: 'Candidate shows strong alignment with required post competencies.',
    },
    MODERATE: {
      min: 40,
      max: 69.99,
      label: 'MODERATE',
      description: 'Candidate demonstrates moderate alignment with notable skill gaps.',
    },
    WEAK: {
      max: 39.99,
      label: 'WEAK',
      description: 'Candidate has low alignment with required post competencies.',
    },
  },
};

