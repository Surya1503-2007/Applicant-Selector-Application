/**
 * @file skillMatchService.js
 * @description Core service for candidate-to-post skill suitability matching.
 * Calculates weighted match percentages, determines suitability bands, detects mandatory skill gaps,
 * and persists explainable match breakdowns into the database.
 */

const prisma = require('../db/prismaClient');
const logicMatcher = require('../matchers/logicMatcher');
const { THRESHOLDS, BANDS } = require('../config/skillMatchConfig');

/**
 * Retrieves all required skills configured for a specific job post.
 *
 * @async
 * @param {string} postId - Unique identifier of the job post.
 * @returns {Promise<Array<object>>} List of required post skills ordered by weight.
 */
async function getPostSkills(postId) {
  if (!postId) {
    throw new Error('postId is required to fetch post skills.');
  }

  return prisma.postSkill.findMany({
    where: { postId },
    orderBy: [{ isMandatory: 'desc' }, { weight: 'desc' }],
  });
}

/**
 * Adds an array of skills to a candidate's profile in an idempotent manner.
 *
 * @async
 * @param {string} candidateId - Unique identifier of the candidate.
 * @param {string[]} skillsArray - Array of skill name strings.
 * @returns {Promise<Array<object>>} List of upserted CandidateSkill records.
 */
async function addCandidateSkills(candidateId, skillsArray) {
  if (!candidateId) {
    throw new Error('candidateId is required to associate skills.');
  }

  if (!Array.isArray(skillsArray) || skillsArray.length === 0) {
    return [];
  }

  // Deduplicate and clean skill names
  const cleanSkills = [
    ...new Set(
      skillsArray
        .map((s) => (typeof s === 'string' ? s.trim() : ''))
        .filter((s) => s.length > 0)
    ),
  ];

  const results = [];
  for (const skillName of cleanSkills) {
    const record = await prisma.candidateSkill.upsert({
      where: {
        candidateId_skillName: {
          candidateId,
          skillName,
        },
      },
      update: {},
      create: {
        candidateId,
        skillName,
      },
    });
    results.push(record);
  }

  return results;
}

/**
 * Retrieves the most recent skill match calculation result for a given candidate and post.
 *
 * @async
 * @param {string} candidateId - Candidate ID.
 * @param {string} postId - Job Post ID.
 * @returns {Promise<object|null>} The most recent SkillMatchResult record.
 */
async function getLatestSkillMatch(candidateId, postId) {
  if (!candidateId || !postId) {
    throw new Error('Both candidateId and postId are required to fetch latest match result.');
  }

  return prisma.skillMatchResult.findFirst({
    where: { candidateId, postId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Evaluates the suitability band based on the final match percentage.
 *
 * @param {number} matchPercent - Calculated match percentage (0 to 100).
 * @returns {string} Evaluated suitability band ("STRONG" | "MODERATE" | "WEAK").
 */
function determineBand(matchPercent) {
  if (matchPercent >= BANDS.STRONG.min) {
    return BANDS.STRONG.label;
  }
  if (matchPercent >= BANDS.MODERATE.min) {
    return BANDS.MODERATE.label;
  }
  return BANDS.WEAK.label;
}

/**
 * Computes the complete skill match evaluation between a candidate's skills and a job post's requirements.
 *
 * Algorithm:
 * 1. For each required post skill, finds the best matching candidate skill using similarity().
 * 2. Computes weighted score: matchPercent = 100 * sum(weight_i * best_i) / sum(weight_i).
 * 3. Categorizes skills as covered if best_i >= THRESHOLDS.SKILL_COVERED (0.5).
 * 4. Checks mandatory skills: flags mandatoryGap=true if any mandatory skill is uncovered (<0.5).
 * 5. Assigns suitability band (STRONG >= 70, MODERATE 40-69, WEAK < 40).
 * 6. Persists audit record into SkillMatchResult table.
 *
 * @async
 * @param {string} candidateId - Unique identifier of the candidate.
 * @param {string} postId - Unique identifier of the job post.
 * @param {object} [matcher=logicMatcher] - Swappable similarity matcher implementing similarity(req, cand).
 * @returns {Promise<{
 *   matchPercent: number,
 *   band: string,
 *   mandatoryGap: boolean,
 *   missingMandatory: string[],
 *   breakdown: Array<{
 *     requiredSkill: string,
 *     weight: number,
 *     isMandatory: boolean,
 *     bestCandidateSkill: string|null,
 *     score: number,
 *     matchType: string
 *   }>,
 *   strengths: string[],
 *   gaps: string[],
 *   resultId?: string
 * }>}
 */
async function computeSkillMatch(candidateId, postId, matcher = logicMatcher) {
  if (!candidateId || !postId) {
    throw new Error('Both candidateId and postId are required to compute skill match.');
  }

  // Verify candidate exists
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: { skills: true },
  });
  if (!candidate) {
    throw new Error(`Candidate with ID "${candidateId}" not found.`);
  }

  // Verify post exists and load required skills
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { postSkills: true },
  });
  if (!post) {
    throw new Error(`Post with ID "${postId}" not found.`);
  }

  const requiredSkills = post.postSkills;
  if (!requiredSkills || requiredSkills.length === 0) {
    throw new Error(`Post "${post.title}" has no defined skill requirements.`);
  }

  const candidateSkills = candidate.skills;

  let totalWeightedScore = 0;
  let totalWeight = 0;
  const breakdown = [];
  const missingMandatory = [];
  const strengths = [];
  const gaps = [];

  for (const postSkill of requiredSkills) {
    totalWeight += postSkill.weight;

    let bestScore = 0.0;
    let bestCandidateSkill = null;
    let bestMatchType = 'none';

    // Search for best matching candidate skill
    for (const candSkill of candidateSkills) {
      const matchResult = matcher.similarity(postSkill.skillName, candSkill.skillName);
      if (matchResult.score > bestScore) {
        bestScore = matchResult.score;
        bestCandidateSkill = candSkill.skillName;
        bestMatchType = matchResult.matchType;
      }
    }

    totalWeightedScore += postSkill.weight * bestScore;

    const isCovered = bestScore >= THRESHOLDS.SKILL_COVERED;

    if (isCovered) {
      strengths.push(postSkill.skillName);
    } else {
      gaps.push(postSkill.skillName);
      if (postSkill.isMandatory) {
        missingMandatory.push(postSkill.skillName);
      }
    }

    breakdown.push({
      requiredSkill: postSkill.skillName,
      weight: postSkill.weight,
      isMandatory: postSkill.isMandatory,
      bestCandidateSkill,
      score: bestScore,
      matchType: bestMatchType,
    });
  }

  // Calculate weighted percentage (0 to 100)
  const rawPercent = totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;
  const matchPercent = Math.round(rawPercent * 100) / 100;

  const band = determineBand(matchPercent);
  const mandatoryGap = missingMandatory.length > 0;

  const responsePayload = {
    matchPercent,
    band,
    mandatoryGap,
    missingMandatory,
    breakdown,
    strengths,
    gaps,
  };

  // Persist result into SkillMatchResult
  const persistedRecord = await prisma.skillMatchResult.create({
    data: {
      candidateId,
      postId,
      matchPercent,
      band,
      breakdown: responsePayload,
    },
  });

  return {
    ...responsePayload,
    resultId: persistedRecord.id,
  };
}

module.exports = {
  getPostSkills,
  addCandidateSkills,
  getLatestSkillMatch,
  computeSkillMatch,
  determineBand,
};

