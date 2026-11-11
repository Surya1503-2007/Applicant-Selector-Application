/**
 * @file testDecisionLogic.js
 * @description Unit tests for the pure decideNext() state machine function in adaptiveEngine.js.
 * Validates 25 distinct branches covering icebreaker transitions, difficulty promotions/demotions,
 * simplified re-ask tracking, topic completion ladders, and stop conditions.
 */

const assert = require('assert');
const { decideNext } = require('../src/engine/adaptiveEngine');
const {
  PHASES,
  ACTIONS,
  END_REASONS,
  DIFFICULTIES,
} = require('../src/config/engineConfig');

function runUnitTests() {
  console.log('========================================================================');
  console.log(' RAC DRDO Adaptive Interview Engine - Unit Tests (decideNext)');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✔ [Case ${String(total).padStart(2, '0')}] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [Case ${String(total).padStart(2, '0')}] ${name}`);
      console.error(`     Error: ${err.message}`);
      throw err;
    }
  }

  const standardAvailability = {
    topicOrder: ['top-1', 'top-2', 'top-3', 'top-4'],
    availablePerTopic: {
      'top-1': { EASY: 2, MEDIUM: 2, HARD: 1, total: 5 },
      'top-2': { EASY: 2, MEDIUM: 2, HARD: 1, total: 5 },
      'top-3': { EASY: 2, MEDIUM: 2, HARD: 1, total: 5 },
      'top-4': { EASY: 2, MEDIUM: 2, HARD: 1, total: 5 },
    },
    hasFollowUp: false,
    availableIcebreakers: 3,
    totalAvailableInPool: 20,
  };

  // -------------------------------------------------------------------------
  // Phase 1: Icebreakers
  // -------------------------------------------------------------------------
  test('Phase 1: Icebreaker 1 answered -> Next icebreaker', () => {
    const state = {
      phase: PHASES.ICEBREAKER,
      currentTopicId: null,
      currentDifficulty: null,
      technicalCount: 0,
      icebreakerCount: 0,
      consecutiveIrrelevant: 0,
      topicProgress: {},
      status: 'ACTIVE',
    };
    const question = { id: 'ice-1', difficulty: 'EASY', levelTag: 'ICEBREAKER' };
    const res = decideNext(state, 'NOT_SCORED', question, standardAvailability);

    assert.strictEqual(res.action, ACTIONS.ICEBREAKER);
    assert.strictEqual(res.nextPhase, PHASES.ICEBREAKER);
  });

  test('Phase 1: Icebreaker 2 answered -> Transition to TECHNICAL at Topic 1, EASY', () => {
    const state = {
      phase: PHASES.ICEBREAKER,
      currentTopicId: null,
      currentDifficulty: null,
      technicalCount: 0,
      icebreakerCount: 1,
      consecutiveIrrelevant: 0,
      topicProgress: {},
      status: 'ACTIVE',
    };
    const question = { id: 'ice-2', difficulty: 'EASY', levelTag: 'ICEBREAKER' };
    const res = decideNext(state, 'NOT_SCORED', question, standardAvailability);

    assert.strictEqual(res.action, ACTIONS.NEXT_TOPIC);
    assert.strictEqual(res.nextPhase, PHASES.TECHNICAL);
    assert.strictEqual(res.nextDifficulty, DIFFICULTIES.EASY);
    assert.strictEqual(res.nextTopicId, 'top-1');
  });

  test('Phase 1: Icebreakers pool empty early -> Transition to TECHNICAL immediately', () => {
    const state = {
      phase: PHASES.ICEBREAKER,
      currentTopicId: null,
      currentDifficulty: null,
      technicalCount: 0,
      icebreakerCount: 0,
      consecutiveIrrelevant: 0,
      topicProgress: {},
      status: 'ACTIVE',
    };
    const availabilityNoIce = {
      ...standardAvailability,
      availableIcebreakers: 0,
    };
    const question = { id: 'ice-1', difficulty: 'EASY', levelTag: 'ICEBREAKER' };
    const res = decideNext(state, 'NOT_SCORED', question, availabilityNoIce);

    assert.strictEqual(res.action, ACTIONS.NEXT_TOPIC);
    assert.strictEqual(res.nextPhase, PHASES.TECHNICAL);
    assert.strictEqual(res.nextDifficulty, DIFFICULTIES.EASY);
  });

  // -------------------------------------------------------------------------
  // Phase 2: EASY Question Transitions
  // -------------------------------------------------------------------------
  test('EASY + IRRELEVANT (reask unused) -> REASK_SIMPLIFIED, same question', () => {
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.EASY,
      technicalCount: 0,
      icebreakerCount: 2,
      consecutiveIrrelevant: 0,
      topicProgress: {
        'top-1': { easyAsked: 0, mediumAsked: 0, hardAsked: 0, finished: false, reaskUsed: false },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-e1', difficulty: 'EASY', topicId: 'top-1', isReask: false };
    const res = decideNext(state, 'IRRELEVANT', question, standardAvailability);

    assert.strictEqual(res.action, ACTIONS.REASK_SIMPLIFIED);
    assert.strictEqual(res.nextDifficulty, DIFFICULTIES.EASY);
    assert.strictEqual(res.sameQuestionId, 'q-top1-e1');
    assert.strictEqual(res.isReask, true);
  });

  test('EASY + IRRELEVANT (reask already used) -> NEXT_SAME, different EASY in same topic', () => {
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.EASY,
      technicalCount: 1,
      icebreakerCount: 2,
      consecutiveIrrelevant: 1,
      topicProgress: {
        'top-1': { easyAsked: 1, mediumAsked: 0, hardAsked: 0, finished: false, reaskUsed: true },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-e1', difficulty: 'EASY', topicId: 'top-1', isReask: true };
    const res = decideNext(state, 'IRRELEVANT', question, standardAvailability);

    assert.strictEqual(res.action, ACTIONS.NEXT_SAME);
    assert.strictEqual(res.nextDifficulty, DIFFICULTIES.EASY);
    assert.strictEqual(res.nextTopicId, 'top-1');
  });

  test('EASY + IRRELEVANT (reask used + easy cap reached) -> NEXT_TOPIC at EASY', () => {
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.EASY,
      technicalCount: 2,
      icebreakerCount: 2,
      consecutiveIrrelevant: 1,
      topicProgress: {
        'top-1': { easyAsked: 2, mediumAsked: 0, hardAsked: 0, finished: false, reaskUsed: true },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-e2', difficulty: 'EASY', topicId: 'top-1', isReask: true };
    const res = decideNext(state, 'IRRELEVANT', question, standardAvailability);

    assert.strictEqual(res.action, ACTIONS.NEXT_TOPIC);
    assert.strictEqual(res.nextTopicId, 'top-2');
    assert.strictEqual(res.nextDifficulty, DIFFICULTIES.EASY);
  });

  test('EASY + PARTIAL (easyAsked < cap) -> NEXT_SAME, another EASY in same topic', () => {
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.EASY,
      technicalCount: 0,
      icebreakerCount: 2,
      consecutiveIrrelevant: 0,
      topicProgress: {
        'top-1': { easyAsked: 0, mediumAsked: 0, hardAsked: 0, finished: false, reaskUsed: false },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-e1', difficulty: 'EASY', topicId: 'top-1' };
    const res = decideNext(state, 'PARTIAL', question, standardAvailability);

    assert.strictEqual(res.action, ACTIONS.NEXT_SAME);
    assert.strictEqual(res.nextDifficulty, DIFFICULTIES.EASY);
    assert.strictEqual(res.nextTopicId, 'top-1');
  });

  test('EASY + PARTIAL (easyAsked >= cap) -> NEXT_HARDER, progressing to MEDIUM', () => {
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.EASY,
      technicalCount: 1,
      icebreakerCount: 2,
      consecutiveIrrelevant: 0,
      topicProgress: {
        'top-1': { easyAsked: 2, mediumAsked: 0, hardAsked: 0, finished: false, reaskUsed: false },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-e2', difficulty: 'EASY', topicId: 'top-1' };
    const res = decideNext(state, 'PARTIAL', question, standardAvailability);

    assert.strictEqual(res.action, ACTIONS.NEXT_HARDER);
    assert.strictEqual(res.nextDifficulty, DIFFICULTIES.MEDIUM);
    assert.strictEqual(res.nextTopicId, 'top-1');
  });

  test('EASY + STRONG -> NEXT_HARDER, progressing to MEDIUM in same topic', () => {
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.EASY,
      technicalCount: 0,
      icebreakerCount: 2,
      consecutiveIrrelevant: 0,
      topicProgress: {
        'top-1': { easyAsked: 0, mediumAsked: 0, hardAsked: 0, finished: false, reaskUsed: false },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-e1', difficulty: 'EASY', topicId: 'top-1' };
    const res = decideNext(state, 'STRONG', question, standardAvailability);

    assert.strictEqual(res.action, ACTIONS.NEXT_HARDER);
    assert.strictEqual(res.nextDifficulty, DIFFICULTIES.MEDIUM);
    assert.strictEqual(res.nextTopicId, 'top-1');
  });

  test('EASY + STRONG (no medium available fallback) -> fallback to remaining EASY in topic', () => {
    const customAvailability = {
      ...standardAvailability,
      availablePerTopic: {
        'top-1': { EASY: 1, MEDIUM: 0, HARD: 1, total: 2 },
      },
    };
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.EASY,
      technicalCount: 0,
      icebreakerCount: 2,
      consecutiveIrrelevant: 0,
      topicProgress: {
        'top-1': { easyAsked: 1, mediumAsked: 0, hardAsked: 0, finished: false, reaskUsed: false },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-e1', difficulty: 'EASY', topicId: 'top-1' };
    const res = decideNext(state, 'STRONG', question, customAvailability);

    assert.strictEqual(res.action, ACTIONS.NEXT_SAME);
    assert.strictEqual(res.nextDifficulty, DIFFICULTIES.EASY);
  });

  // -------------------------------------------------------------------------
  // Phase 2: MEDIUM Question Transitions
  // -------------------------------------------------------------------------
  test('MEDIUM + IRRELEVANT -> NEXT_EASIER, dropping back to EASY in same topic', () => {
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.MEDIUM,
      technicalCount: 1,
      icebreakerCount: 2,
      consecutiveIrrelevant: 0,
      topicProgress: {
        'top-1': { easyAsked: 1, mediumAsked: 0, hardAsked: 0, finished: false, reaskUsed: false },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-m1', difficulty: 'MEDIUM', topicId: 'top-1' };
    const res = decideNext(state, 'IRRELEVANT', question, standardAvailability);

    assert.strictEqual(res.action, ACTIONS.NEXT_EASIER);
    assert.strictEqual(res.nextDifficulty, DIFFICULTIES.EASY);
    assert.strictEqual(res.nextTopicId, 'top-1');
  });

  test('MEDIUM + IRRELEVANT (no easy remaining in topic) -> NEXT_TOPIC at EASY', () => {
    const customAvailability = {
      ...standardAvailability,
      availablePerTopic: {
        ...standardAvailability.availablePerTopic,
        'top-1': { EASY: 0, MEDIUM: 1, HARD: 1, total: 2 },
      },
    };
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.MEDIUM,
      technicalCount: 2,
      icebreakerCount: 2,
      consecutiveIrrelevant: 0,
      topicProgress: {
        'top-1': { easyAsked: 2, mediumAsked: 0, hardAsked: 0, finished: false, reaskUsed: false },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-m1', difficulty: 'MEDIUM', topicId: 'top-1' };
    const res = decideNext(state, 'IRRELEVANT', question, customAvailability);

    assert.strictEqual(res.action, ACTIONS.NEXT_TOPIC);
    assert.strictEqual(res.nextTopicId, 'top-2');
    assert.strictEqual(res.nextDifficulty, DIFFICULTIES.EASY);
  });

  test('MEDIUM + PARTIAL (mediumAsked < cap) -> NEXT_SAME, another MEDIUM in same topic', () => {
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.MEDIUM,
      technicalCount: 1,
      icebreakerCount: 2,
      consecutiveIrrelevant: 0,
      topicProgress: {
        'top-1': { easyAsked: 1, mediumAsked: 0, hardAsked: 0, finished: false, reaskUsed: false },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-m1', difficulty: 'MEDIUM', topicId: 'top-1' };
    const res = decideNext(state, 'PARTIAL', question, standardAvailability);

    assert.strictEqual(res.action, ACTIONS.NEXT_SAME);
    assert.strictEqual(res.nextDifficulty, DIFFICULTIES.MEDIUM);
    assert.strictEqual(res.nextTopicId, 'top-1');
  });

  test('MEDIUM + PARTIAL (mediumAsked >= cap) -> NEXT_TOPIC at EASY (topic completed)', () => {
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.MEDIUM,
      technicalCount: 3,
      icebreakerCount: 2,
      consecutiveIrrelevant: 0,
      topicProgress: {
        'top-1': { easyAsked: 1, mediumAsked: 2, hardAsked: 0, finished: false, reaskUsed: false },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-m2', difficulty: 'MEDIUM', topicId: 'top-1' };
    const res = decideNext(state, 'PARTIAL', question, standardAvailability);

    assert.strictEqual(res.action, ACTIONS.NEXT_TOPIC);
    assert.strictEqual(res.nextTopicId, 'top-2');
    assert.strictEqual(res.nextDifficulty, DIFFICULTIES.EASY);
  });

  test('MEDIUM + STRONG (hard available) -> NEXT_HARDER, progressing to HARD in same topic', () => {
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.MEDIUM,
      technicalCount: 1,
      icebreakerCount: 2,
      consecutiveIrrelevant: 0,
      topicProgress: {
        'top-1': { easyAsked: 1, mediumAsked: 0, hardAsked: 0, finished: false, reaskUsed: false },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-m1', difficulty: 'MEDIUM', topicId: 'top-1' };
    const res = decideNext(state, 'STRONG', question, standardAvailability);

    assert.strictEqual(res.action, ACTIONS.NEXT_HARDER);
    assert.strictEqual(res.nextDifficulty, DIFFICULTIES.HARD);
    assert.strictEqual(res.nextTopicId, 'top-1');
  });

  test('MEDIUM + STRONG (no hard available) -> NEXT_TOPIC at EASY (topic finished)', () => {
    const customAvailability = {
      ...standardAvailability,
      availablePerTopic: {
        ...standardAvailability.availablePerTopic,
        'top-1': { EASY: 1, MEDIUM: 1, HARD: 0, total: 2 },
      },
    };
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.MEDIUM,
      technicalCount: 2,
      icebreakerCount: 2,
      consecutiveIrrelevant: 0,
      topicProgress: {
        'top-1': { easyAsked: 1, mediumAsked: 1, hardAsked: 0, finished: false, reaskUsed: false },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-m1', difficulty: 'MEDIUM', topicId: 'top-1' };
    const res = decideNext(state, 'STRONG', question, customAvailability);

    assert.strictEqual(res.action, ACTIONS.NEXT_TOPIC);
    assert.strictEqual(res.nextTopicId, 'top-2');
    assert.strictEqual(res.nextDifficulty, DIFFICULTIES.EASY);
  });

  // -------------------------------------------------------------------------
  // Phase 2: HARD Question Transitions
  // -------------------------------------------------------------------------
  test('HARD + IRRELEVANT -> NEXT_TOPIC at EASY (topic ceiling reached)', () => {
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.HARD,
      technicalCount: 2,
      icebreakerCount: 2,
      consecutiveIrrelevant: 0,
      topicProgress: {
        'top-1': { easyAsked: 1, mediumAsked: 1, hardAsked: 0, finished: false, reaskUsed: false },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-h1', difficulty: 'HARD', topicId: 'top-1' };
    const res = decideNext(state, 'IRRELEVANT', question, standardAvailability);

    assert.strictEqual(res.action, ACTIONS.NEXT_TOPIC);
    assert.strictEqual(res.nextTopicId, 'top-2');
    assert.strictEqual(res.nextDifficulty, DIFFICULTIES.EASY);
  });

  test('HARD + PARTIAL -> NEXT_TOPIC at EASY (topic ceiling reached)', () => {
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.HARD,
      technicalCount: 2,
      icebreakerCount: 2,
      consecutiveIrrelevant: 0,
      topicProgress: {
        'top-1': { easyAsked: 1, mediumAsked: 1, hardAsked: 0, finished: false, reaskUsed: false },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-h1', difficulty: 'HARD', topicId: 'top-1' };
    const res = decideNext(state, 'PARTIAL', question, standardAvailability);

    assert.strictEqual(res.action, ACTIONS.NEXT_TOPIC);
    assert.strictEqual(res.nextTopicId, 'top-2');
    assert.strictEqual(res.nextDifficulty, DIFFICULTIES.EASY);
  });

  test('HARD + STRONG -> NEXT_TOPIC at EASY (topic mastered)', () => {
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.HARD,
      technicalCount: 2,
      icebreakerCount: 2,
      consecutiveIrrelevant: 0,
      topicProgress: {
        'top-1': { easyAsked: 1, mediumAsked: 1, hardAsked: 0, finished: false, reaskUsed: false },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-h1', difficulty: 'HARD', topicId: 'top-1' };
    const res = decideNext(state, 'STRONG', question, standardAvailability);

    assert.strictEqual(res.action, ACTIONS.NEXT_TOPIC);
    assert.strictEqual(res.nextTopicId, 'top-2');
    assert.strictEqual(res.nextDifficulty, DIFFICULTIES.EASY);
  });

  // -------------------------------------------------------------------------
  // Stop Conditions
  // -------------------------------------------------------------------------
  test('Stop Condition: 3 consecutive IRRELEVANT answers -> END with CANDIDATE_STRUGGLING', () => {
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.EASY,
      technicalCount: 2,
      icebreakerCount: 2,
      consecutiveIrrelevant: 2, // 2 previous + 1 current = 3
      topicProgress: {
        'top-1': { easyAsked: 2, mediumAsked: 0, hardAsked: 0, finished: false, reaskUsed: true },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-e2', difficulty: 'EASY', topicId: 'top-1', isReask: true };
    const res = decideNext(state, 'IRRELEVANT', question, standardAvailability);

    assert.strictEqual(res.action, ACTIONS.END);
    assert.strictEqual(res.end.reason, END_REASONS.CANDIDATE_STRUGGLING);
  });

  test('Stop Condition: consecutive IRRELEVANT counter resets to 0 on PARTIAL or STRONG', () => {
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.EASY,
      technicalCount: 2,
      icebreakerCount: 2,
      consecutiveIrrelevant: 2, // was 2, now PARTIAL
      topicProgress: {
        'top-1': { easyAsked: 1, mediumAsked: 0, hardAsked: 0, finished: false, reaskUsed: false },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-e1', difficulty: 'EASY', topicId: 'top-1' };
    const res = decideNext(state, 'PARTIAL', question, standardAvailability);

    // Must NOT end
    assert.notStrictEqual(res.action, ACTIONS.END);
  });

  test('Stop Condition: Max technical questions reached (10) -> END with MAX_QUESTIONS_REACHED', () => {
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-4',
      currentDifficulty: DIFFICULTIES.MEDIUM,
      technicalCount: 9, // 9 previous + 1 current = 10
      icebreakerCount: 2,
      consecutiveIrrelevant: 0,
      topicProgress: {
        'top-4': { easyAsked: 1, mediumAsked: 0, hardAsked: 0, finished: false, reaskUsed: false },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top4-m1', difficulty: 'MEDIUM', topicId: 'top-4' };
    const res = decideNext(state, 'STRONG', question, standardAvailability);

    assert.strictEqual(res.action, ACTIONS.END);
    assert.strictEqual(res.end.reason, END_REASONS.MAX_QUESTIONS_REACHED);
  });

  test('Stop Condition: All topics finished -> END with ALL_TOPICS_FINISHED', () => {
    const allTopicsFinishedProg = {
      'top-1': { finished: true },
      'top-2': { finished: true },
      'top-3': { finished: true },
      'top-4': { easyAsked: 1, mediumAsked: 1, hardAsked: 0, finished: false, reaskUsed: false },
    };
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-4',
      currentDifficulty: DIFFICULTIES.HARD,
      technicalCount: 7,
      icebreakerCount: 2,
      consecutiveIrrelevant: 0,
      topicProgress: allTopicsFinishedProg,
      status: 'ACTIVE',
    };
    const question = { id: 'q-top4-h1', difficulty: 'HARD', topicId: 'top-4' };
    const res = decideNext(state, 'STRONG', question, standardAvailability);

    assert.strictEqual(res.action, ACTIONS.END);
    assert.strictEqual(res.end.reason, END_REASONS.ALL_TOPICS_FINISHED);
  });

  test('Stop Condition: Question pool exhausted -> END with ALL_TOPICS_FINISHED or POOL_EXHAUSTED', () => {
    const emptyAvailability = {
      topicOrder: ['top-1'],
      availablePerTopic: {
        'top-1': { EASY: 0, MEDIUM: 0, HARD: 0, total: 0 },
      },
      hasFollowUp: false,
      availableIcebreakers: 0,
      totalAvailableInPool: 0,
    };
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.HARD,
      technicalCount: 3,
      icebreakerCount: 2,
      consecutiveIrrelevant: 0,
      topicProgress: {
        'top-1': { easyAsked: 1, mediumAsked: 1, hardAsked: 1, finished: false, reaskUsed: false },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-h1', difficulty: 'HARD', topicId: 'top-1' };
    const res = decideNext(state, 'STRONG', question, emptyAvailability);

    assert.strictEqual(res.action, ACTIONS.END);
  });

  test('Hard Guarantee: Difficulty cannot jump from EASY to HARD directly', () => {
    const state = {
      phase: PHASES.TECHNICAL,
      currentTopicId: 'top-1',
      currentDifficulty: DIFFICULTIES.EASY,
      technicalCount: 0,
      icebreakerCount: 2,
      consecutiveIrrelevant: 0,
      topicProgress: {
        'top-1': { easyAsked: 0, mediumAsked: 0, hardAsked: 0, finished: false, reaskUsed: false },
      },
      status: 'ACTIVE',
    };
    const question = { id: 'q-top1-e1', difficulty: 'EASY', topicId: 'top-1' };
    const res = decideNext(state, 'STRONG', question, standardAvailability);

    // Must be MEDIUM, never HARD
    assert.strictEqual(res.nextDifficulty, DIFFICULTIES.MEDIUM);
    assert.notStrictEqual(res.nextDifficulty, DIFFICULTIES.HARD);
  });

  console.log(`\n========================================================================`);
  console.log(` ALL ${passed}/${total} UNIT TESTS PASSED WITH 100% SUCCESS`);
  console.log(`========================================================================\n`);
}

runUnitTests();

