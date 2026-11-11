/**
 * @file adaptiveEngine.js
 * @description Core deterministic state machine for the RAC DRDO Adaptive Interview Engine.
 * Contains pure functions for deciding next question difficulty, topic transitions,
 * simplified re-ask rules, and stop conditions.
 */

const {
  PHASES,
  ACTIONS,
  END_REASONS,
  LIMITS,
  DIFFICULTIES,
  DIFFICULTY_LADDER,
} = require('../config/engineConfig');

/**
 * Pluggable strategy to determine the next topic in the interview.
 * Default strategy: round-robin over the subject's topics.
 *
 * TODO [Skill-Match Integration]: Prioritize topics where candidate demonstrated
 * skill gaps in Part 2 SkillMatchResult.
 *
 * @param {string[]} topicOrder - Ordered list of topic IDs for the subject.
 * @param {object} topicProgress - Map of topic progress states { [topicId]: { finished, ... } }.
 * @param {object} availablePerTopic - Map of available questions per topic.
 * @param {string} [currentTopicId] - Currently active topic ID.
 * @returns {string|null} The next eligible topic ID, or null if all topics are finished/exhausted.
 */
function getNextEligibleTopic(topicOrder, topicProgress, availablePerTopic, currentTopicId) {
  if (!Array.isArray(topicOrder) || topicOrder.length === 0) {
    return null;
  }

  // Find index of current topic
  const currentIndex = topicOrder.indexOf(currentTopicId);
  const searchOrder = [];

  // Round-robin starting after current topic
  for (let i = 1; i <= topicOrder.length; i++) {
    const idx = (currentIndex + i) % topicOrder.length;
    searchOrder.push(topicOrder[idx]);
  }

  for (const tid of searchOrder) {
    const prog = topicProgress[tid];
    const isFinished = prog && prog.finished;
    const available = availablePerTopic[tid] && availablePerTopic[tid].total > 0;

    if (!isFinished && available) {
      return tid;
    }
  }

  return null;
}

/**
 * Pure decision function evaluating the candidate's last answer verdict and the current
 * state of the interview to compute the next transition action, target difficulty, and topic.
 *
 * @param {object} state - Current interview session state snapshot.
 * @param {string} state.phase - 'ICEBREAKER' | 'TECHNICAL' | 'COMPLETED'.
 * @param {string|null} state.currentTopicId - Active topic ID.
 * @param {string|null} state.currentDifficulty - Active difficulty ('EASY' | 'MEDIUM' | 'HARD').
 * @param {number} state.technicalCount - Total technical questions asked so far.
 * @param {number} state.icebreakerCount - Total icebreakers asked so far.
 * @param {number} state.consecutiveIrrelevant - Counter of consecutive IRRELEVANT answers.
 * @param {object} state.topicProgress - Progress per topic { [topicId]: { easyAsked, mediumAsked, hardAsked, finished, lastVerdict, reaskUsed } }.
 * @param {string} state.status - 'ACTIVE' | 'COMPLETED'.
 * @param {string} verdict - Part 3 verdict: 'IRRELEVANT' | 'PARTIAL' | 'STRONG' | 'NOT_SCORED'.
 * @param {object} question - Question just answered { id, difficulty, topicId, levelTag, isReask }.
 * @param {object} availability - Question availability in database pool.
 * @param {string[]} availability.topicOrder - Array of topic IDs in subject.
 * @param {object} availability.availablePerTopic - { [topicId]: { EASY: n, MEDIUM: n, HARD: n, total: n } }.
 * @param {boolean} [availability.hasFollowUp=false] - Whether linked follow-up exists for this question.
 * @param {number} [availability.totalAvailableInPool=0] - Total unasked technical questions in pool.
 * @param {number} [availability.availableIcebreakers=0] - Total unasked icebreakers.
 *
 * @returns {{
 *   action: string,
 *   nextDifficulty: string|null,
 *   nextTopicId: string|null,
 *   nextPhase?: string,
 *   reason: string,
 *   isReask?: boolean,
 *   sameQuestionId?: string,
 *   end?: { reason: string }
 * }}
 */
function decideNext(state, verdict, question, availability) {
  // Guard: if already completed
  if (state.status === 'COMPLETED') {
    return {
      action: ACTIONS.END,
      nextDifficulty: null,
      nextTopicId: null,
      end: { reason: state.endReason || END_REASONS.BOARD_TERMINATED },
      reason: 'Interview session is already marked completed.',
    };
  }

  const topicOrder = availability.topicOrder || [];
  const availablePerTopic = availability.availablePerTopic || {};
  const topicProgress = state.topicProgress ? JSON.parse(JSON.stringify(state.topicProgress)) : {};

  // =========================================================================
  // Phase 1: Icebreakers
  // =========================================================================
  if (state.phase === PHASES.ICEBREAKER) {
    const nextIcebreakerCount = (state.icebreakerCount || 0) + 1;

    // Check if more icebreakers should be asked
    if (nextIcebreakerCount < LIMITS.ICEBREAKER_COUNT) {
      if ((availability.availableIcebreakers || 0) > 0) {
        return {
          action: ACTIONS.ICEBREAKER,
          nextDifficulty: null,
          nextTopicId: null,
          nextPhase: PHASES.ICEBREAKER,
          reason: `Icebreaker ${nextIcebreakerCount} completed -> serving next icebreaker (${nextIcebreakerCount + 1}/${LIMITS.ICEBREAKER_COUNT}).`,
        };
      }
    }

    // Icebreaker phase finished -> Transition to TECHNICAL phase
    const firstTopicId = topicOrder[0] || null;
    if (!firstTopicId || !availablePerTopic[firstTopicId] || availablePerTopic[firstTopicId].total === 0) {
      // Find first topic that has available questions
      const eligibleTopicId = getNextEligibleTopic(topicOrder, topicProgress, availablePerTopic, null);
      if (!eligibleTopicId) {
        return {
          action: ACTIONS.END,
          nextDifficulty: null,
          nextTopicId: null,
          end: { reason: END_REASONS.POOL_EXHAUSTED },
          reason: 'No technical questions available in pool -> ending interview.',
        };
      }
      return {
        action: ACTIONS.NEXT_TOPIC,
        nextDifficulty: DIFFICULTIES.EASY,
        nextTopicId: eligibleTopicId,
        nextPhase: PHASES.TECHNICAL,
        reason: `Icebreaker phase completed -> starting technical evaluation with topic ${eligibleTopicId} at EASY.`,
      };
    }

    return {
      action: ACTIONS.NEXT_TOPIC,
      nextDifficulty: DIFFICULTIES.EASY,
      nextTopicId: firstTopicId,
      nextPhase: PHASES.TECHNICAL,
      reason: `Icebreaker phase completed -> starting technical evaluation with topic ${firstTopicId} at EASY.`,
    };
  }

  // =========================================================================
  // Phase 2: Technical Adaptive State Machine
  // =========================================================================
  const nextTechnicalCount = (state.technicalCount || 0) + 1;
  const nextConsecutiveIrrelevant = verdict === 'IRRELEVANT' ? (state.consecutiveIrrelevant || 0) + 1 : 0;

  // Stop Condition 1: Consecutive IRRELEVANT answers limit reached
  if (nextConsecutiveIrrelevant >= LIMITS.CONSECUTIVE_IRRELEVANT_LIMIT) {
    return {
      action: ACTIONS.END,
      nextDifficulty: null,
      nextTopicId: null,
      end: { reason: END_REASONS.CANDIDATE_STRUGGLING },
      reason: `Candidate received ${nextConsecutiveIrrelevant} consecutive IRRELEVANT answers -> ending early (CANDIDATE_STRUGGLING).`,
    };
  }

  // Stop Condition 2: Max technical questions limit reached
  if (nextTechnicalCount >= LIMITS.MAX_TECHNICAL_QUESTIONS) {
    return {
      action: ACTIONS.END,
      nextDifficulty: null,
      nextTopicId: null,
      end: { reason: END_REASONS.MAX_QUESTIONS_REACHED },
      reason: `Total technical questions reached max limit (${LIMITS.MAX_TECHNICAL_QUESTIONS}) -> interview completed.`,
    };
  }

  const currentTopicId = question.topicId || state.currentTopicId;
  if (!topicProgress[currentTopicId]) {
    topicProgress[currentTopicId] = {
      easyAsked: 0,
      mediumAsked: 0,
      hardAsked: 0,
      finished: false,
      lastVerdict: null,
      reaskUsed: false,
    };
  }
  const prog = topicProgress[currentTopicId];
  prog.lastVerdict = verdict;

  const currentDiff = question.difficulty || state.currentDifficulty || DIFFICULTIES.EASY;
  const topicPool = availablePerTopic[currentTopicId] || { EASY: 0, MEDIUM: 0, HARD: 0, total: 0 };

  // -------------------------------------------------------------------------
  // Case A: Answered EASY question
  // -------------------------------------------------------------------------
  if (currentDiff === DIFFICULTIES.EASY) {
    if (verdict === 'IRRELEVANT') {
      // Rule: First re-ask simplified version of same question
      if (!prog.reaskUsed && !question.isReask) {
        return {
          action: ACTIONS.REASK_SIMPLIFIED,
          nextDifficulty: DIFFICULTIES.EASY,
          nextTopicId: currentTopicId,
          sameQuestionId: question.id,
          isReask: true,
          reason: `IRRELEVANT answer on EASY question "${question.id}" -> re-asking question in simplified phrasing.`,
        };
      }

      // Re-ask was already used for this question or candidate failed the re-ask
      prog.reaskUsed = false;

      // Ask another EASY question in same topic if available and cap not exceeded
      if (prog.easyAsked < LIMITS.MAX_EASY_PER_TOPIC && topicPool.EASY > 0) {
        return {
          action: ACTIONS.NEXT_SAME,
          nextDifficulty: DIFFICULTIES.EASY,
          nextTopicId: currentTopicId,
          reason: 'IRRELEVANT answer on EASY question (re-ask exhausted) -> asking another EASY question in same topic.',
        };
      }

      // No more easy available or cap reached -> finish topic and move to next
      prog.finished = true;
      return transitionToNextTopic(
        currentTopicId,
        topicOrder,
        topicProgress,
        availablePerTopic,
        'IRRELEVANT answer on EASY question and easy quota/pool exhausted'
      );
    }

    if (verdict === 'PARTIAL') {
      prog.reaskUsed = false;
      // If easyAsked < maxEasyPerTopic and another easy is available, ask another EASY
      if (prog.easyAsked < LIMITS.MAX_EASY_PER_TOPIC && topicPool.EASY > 0) {
        return {
          action: ACTIONS.NEXT_SAME,
          nextDifficulty: DIFFICULTIES.EASY,
          nextTopicId: currentTopicId,
          reason: `PARTIAL answer on EASY question (${prog.easyAsked}/${LIMITS.MAX_EASY_PER_TOPIC}) -> asking another EASY question in same topic.`,
        };
      }

      // Otherwise move to MEDIUM
      return progressToMedium(currentTopicId, topicPool, topicOrder, topicProgress, availablePerTopic, 'PARTIAL answer on EASY question (easy quota reached)');
    }

    if (verdict === 'STRONG') {
      prog.reaskUsed = false;
      // Strong on EASY -> progress to MEDIUM
      return progressToMedium(currentTopicId, topicPool, topicOrder, topicProgress, availablePerTopic, 'STRONG answer on EASY question');
    }
  }

  // -------------------------------------------------------------------------
  // Case B: Answered MEDIUM question
  // -------------------------------------------------------------------------
  if (currentDiff === DIFFICULTIES.MEDIUM) {
    if (verdict === 'IRRELEVANT') {
      prog.reaskUsed = false;
      // Drop back to EASY in the same topic if available
      if (topicPool.EASY > 0 && prog.easyAsked < LIMITS.MAX_EASY_PER_TOPIC) {
        return {
          action: ACTIONS.NEXT_EASIER,
          nextDifficulty: DIFFICULTIES.EASY,
          nextTopicId: currentTopicId,
          reason: 'IRRELEVANT answer on MEDIUM question -> stepping down to EASY in same topic.',
        };
      }

      // If no EASY in topic, drop to next topic at EASY
      prog.finished = true;
      return transitionToNextTopic(
        currentTopicId,
        topicOrder,
        topicProgress,
        availablePerTopic,
        'IRRELEVANT answer on MEDIUM question and no EASY questions available in topic'
      );
    }

    if (verdict === 'PARTIAL') {
      prog.reaskUsed = false;
      // If mediumAsked < maxMediumPerTopic and another medium available, probe further at MEDIUM
      if (prog.mediumAsked < LIMITS.MAX_MEDIUM_PER_TOPIC && topicPool.MEDIUM > 0) {
        return {
          action: ACTIONS.NEXT_SAME,
          nextDifficulty: DIFFICULTIES.MEDIUM,
          nextTopicId: currentTopicId,
          reason: `PARTIAL answer on MEDIUM question (${prog.mediumAsked}/${LIMITS.MAX_MEDIUM_PER_TOPIC}) -> probing further at MEDIUM in same topic.`,
        };
      }

      // Medium quota reached -> topic completed
      prog.finished = true;
      return transitionToNextTopic(
        currentTopicId,
        topicOrder,
        topicProgress,
        availablePerTopic,
        'PARTIAL answer on MEDIUM question and medium quota reached -> Topic finished'
      );
    }

    if (verdict === 'STRONG') {
      prog.reaskUsed = false;
      // Strong on MEDIUM -> progress to HARD
      if (topicPool.HARD > 0) {
        return {
          action: ACTIONS.NEXT_HARDER,
          nextDifficulty: DIFFICULTIES.HARD,
          nextTopicId: currentTopicId,
          reason: 'STRONG answer on MEDIUM question -> progressing to HARD in same topic.',
        };
      }

      // No HARD available in this topic -> Topic mastered/finished
      prog.finished = true;
      return transitionToNextTopic(
        currentTopicId,
        topicOrder,
        topicProgress,
        availablePerTopic,
        'STRONG answer on MEDIUM question (no HARD questions available) -> Topic finished'
      );
    }
  }

  // -------------------------------------------------------------------------
  // Case C: Answered HARD question
  // -------------------------------------------------------------------------
  if (currentDiff === DIFFICULTIES.HARD) {
    prog.reaskUsed = false;
    prog.finished = true;

    if (verdict === 'STRONG') {
      return transitionToNextTopic(
        currentTopicId,
        topicOrder,
        topicProgress,
        availablePerTopic,
        'STRONG answer on HARD question -> Topic mastered'
      );
    }

    // IRRELEVANT or PARTIAL on HARD -> ceiling reached
    return transitionToNextTopic(
      currentTopicId,
      topicOrder,
      topicProgress,
      availablePerTopic,
      `${verdict} answer on HARD question -> Topic ceiling reached`
    );
  }

  // Fallback default
  return transitionToNextTopic(currentTopicId, topicOrder, topicProgress, availablePerTopic, 'Default progression transition');
}

/**
 * Handles transition to MEDIUM difficulty with graceful fallback if no MEDIUM question exists.
 */
function progressToMedium(currentTopicId, topicPool, topicOrder, topicProgress, availablePerTopic, reasonContext) {
  if (topicPool.MEDIUM > 0) {
    return {
      action: ACTIONS.NEXT_HARDER,
      nextDifficulty: DIFFICULTIES.MEDIUM,
      nextTopicId: currentTopicId,
      reason: `${reasonContext} -> progressing to MEDIUM.`,
    };
  }

  // Fallback: candidate earned advancement, but topic has no unasked MEDIUM questions
  // Candidate cannot jump directly to HARD (difficulty can only rise by one level per step)
  // Check if topic has another EASY or move to next topic
  if (topicPool.EASY > 0) {
    return {
      action: ACTIONS.NEXT_SAME,
      nextDifficulty: DIFFICULTIES.EASY,
      nextTopicId: currentTopicId,
      reason: `${reasonContext} -> earned MEDIUM but none available in topic, falling back to remaining EASY.`,
    };
  }

  // Finish topic and move to next topic
  topicProgress[currentTopicId].finished = true;
  return transitionToNextTopic(
    currentTopicId,
    topicOrder,
    topicProgress,
    availablePerTopic,
    `${reasonContext} -> no MEDIUM questions available in topic`
  );
}

/**
 * Transitions from a completed or exhausted topic to the next eligible topic.
 */
function transitionToNextTopic(currentTopicId, topicOrder, topicProgress, availablePerTopic, reasonContext) {
  const nextTopicId = getNextEligibleTopic(topicOrder, topicProgress, availablePerTopic, currentTopicId);

  if (!nextTopicId) {
    // All topics finished or exhausted
    return {
      action: ACTIONS.END,
      nextDifficulty: null,
      nextTopicId: null,
      end: { reason: END_REASONS.ALL_TOPICS_FINISHED },
      reason: `${reasonContext} -> All available topics have been completed.`,
    };
  }

  // Target difficulty for fresh topic is always EASY
  const nextTopicPool = availablePerTopic[nextTopicId] || { EASY: 0, MEDIUM: 0, HARD: 0, total: 0 };
  let targetDifficulty = DIFFICULTIES.EASY;

  if (nextTopicPool.EASY === 0) {
    // Fallback if fresh topic has no easy questions
    targetDifficulty = nextTopicPool.MEDIUM > 0 ? DIFFICULTIES.MEDIUM : DIFFICULTIES.HARD;
  }

  return {
    action: ACTIONS.NEXT_TOPIC,
    nextDifficulty: targetDifficulty,
    nextTopicId,
    reason: `${reasonContext} -> moving to next topic (${nextTopicId}) at ${targetDifficulty}.`,
  };
}

module.exports = {
  decideNext,
  getNextEligibleTopic,
};

