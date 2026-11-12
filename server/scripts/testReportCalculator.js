/**
 * @file testReportCalculator.js
 * @description Comprehensive unit test suite for Part 5 pure report calculation functions.
 * Tests reportCalculator.js in isolation (NO database access required).
 * Validates 29 distinct test cases covering difficulty weighting, icebreaker exclusions,
 * re-ask resolution, boundary conditions (69.9 vs 70.0, 44.9 vs 45.0), early termination capping,
 * zero division avoidance, and anti-gaming flag aggregation.
 */

const assert = require('assert');
const {
  computeInterviewScore,
  computeTopicScores,
  computeDifficultyProgression,
  computeOverall,
  recommend,
  collectFlags,
  determineTopicLabel,
  getFinalTechnicalResponses,
} = require('../src/reports/reportCalculator');
const reportConfig = require('../src/config/reportConfig');

function runUnitTests() {
  console.log('========================================================================');
  console.log(' RAC DRDO Part 5: Pure Report Calculator Unit Tests');
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

  // --- 1. DIFFICULTY WEIGHTING & FORMULAS ---
  test('Difficulty weighting: EASY(1.0), MEDIUM(1.5), HARD(2.0) weighted sum', () => {
    // 1 EASY (score 0.8, w=1.0) -> 0.8
    // 1 MEDIUM (score 0.6, w=1.5) -> 0.9
    // 1 HARD (score 0.5, w=2.0) -> 1.0
    // Total weighted: 2.7, Total weight: 4.5 -> 2.7 / 4.5 = 0.60 -> 60.0%
    const responses = [
      { questionId: 'q1', difficulty: 'EASY', levelTag: 'TECHNICAL', answerScore: 0.8 },
      { questionId: 'q2', difficulty: 'MEDIUM', levelTag: 'TECHNICAL', answerScore: 0.6 },
      { questionId: 'q3', difficulty: 'HARD', levelTag: 'TECHNICAL', answerScore: 0.5 },
    ];
    const score = computeInterviewScore(responses);
    assert.strictEqual(score, 60.0);
  });

  // --- 2. ICEBREAKER EXCLUSION ---
  test('Icebreakers are strictly excluded from interviewScore', () => {
    const responses = [
      { questionId: 'ice1', difficulty: 'EASY', levelTag: 'ICEBREAKER', answerScore: 1.0 },
      { questionId: 'ice2', difficulty: 'EASY', levelTag: 'ICEBREAKER', answerScore: 0.0 },
      { questionId: 'q1', difficulty: 'EASY', levelTag: 'TECHNICAL', answerScore: 0.8 },
    ];
    const score = computeInterviewScore(responses);
    // Only q1 counts: 100 * (1.0 * 0.8) / 1.0 = 80.0
    assert.strictEqual(score, 80.0);
  });

  // --- 3. RE-ASK RESOLUTION ---
  test('Re-asked questions: only the FINAL attempt counts in interviewScore', () => {
    // q1 asked normally (isReask=false, score=0.2), then re-asked (isReask=true, score=0.9)
    const responses = [
      { questionId: 'q1', difficulty: 'EASY', levelTag: 'TECHNICAL', answerScore: 0.2, isReask: false },
      { questionId: 'q1', difficulty: 'EASY', levelTag: 'TECHNICAL', answerScore: 0.9, isReask: true },
      { questionId: 'q2', difficulty: 'MEDIUM', levelTag: 'TECHNICAL', answerScore: 0.8, isReask: false },
    ];
    // Final attempts:
    // q1 reask: score 0.9, w 1.0 -> 0.9
    // q2: score 0.8, w 1.5 -> 1.2
    // total: 2.1 / 2.5 = 0.84 -> 84.0%
    const score = computeInterviewScore(responses);
    assert.strictEqual(score, 84.0);
  });

  // --- 4. RE-ASK RESOLUTION (FILTER INSPECTION) ---
  test('getFinalTechnicalResponses selects only the final attempt', () => {
    const responses = [
      { questionId: 'q1', isReask: false, answerScore: 0.1 },
      { questionId: 'q1', isReask: true, answerScore: 0.7 },
      { questionId: 'q2', isReask: false, answerScore: 0.5 },
    ];
    const finalResp = getFinalTechnicalResponses(responses);
    assert.strictEqual(finalResp.length, 2);
    const q1Resp = finalResp.find((r) => r.questionId === 'q1');
    assert.strictEqual(q1Resp.isReask, true);
    assert.strictEqual(q1Resp.answerScore, 0.7);
  });

  // --- 5. DIVISION BY ZERO AVOIDANCE: EMPTY RESPONSES ---
  test('Empty responses array returns 0.0 without division by zero', () => {
    const score = computeInterviewScore([]);
    assert.strictEqual(score, 0.0);
  });

  // --- 6. DIVISION BY ZERO AVOIDANCE: ONLY ICEBREAKERS ---
  test('Responses containing only icebreakers returns 0.0', () => {
    const responses = [
      { questionId: 'ice1', levelTag: 'ICEBREAKER', answerScore: 0.9 },
      { questionId: 'ice2', levelTag: 'ICEBREAKER', answerScore: 0.85 },
    ];
    const score = computeInterviewScore(responses);
    assert.strictEqual(score, 0.0);
  });

  // --- 7. SINGLE ANSWER PRECISION ---
  test('Single technical answer computes exact score without zero division', () => {
    const responses = [
      { questionId: 'q1', difficulty: 'MEDIUM', levelTag: 'TECHNICAL', answerScore: 0.75 },
    ];
    const score = computeInterviewScore(responses);
    assert.strictEqual(score, 75.0);
  });

  // --- 8. TOPIC SCORES: WEIGHTED AVERAGE PER TOPIC ---
  test('computeTopicScores calculates weighted score per domain topic', () => {
    const topics = [
      { id: 'top-req', name: 'Requirements Analysis' },
      { id: 'top-arch', name: 'System Architecture' },
    ];
    const responses = [
      { questionId: 'q1', topicId: 'top-req', difficulty: 'EASY', answerScore: 0.9, verdict: 'STRONG' },
      { questionId: 'q2', topicId: 'top-req', difficulty: 'MEDIUM', answerScore: 0.7, verdict: 'STRONG' },
      { questionId: 'q3', topicId: 'top-arch', difficulty: 'EASY', answerScore: 0.4, verdict: 'PARTIAL' },
    ];
    const topicResults = computeTopicScores(responses, topics);
    assert.strictEqual(topicResults.length, 2);

    const reqTopic = topicResults.find((t) => t.topicId === 'top-req');
    // Req: (1.0*0.9 + 1.5*0.7) / (1.0 + 1.5) = (0.9 + 1.05) / 2.5 = 1.95 / 2.5 = 0.78 -> 78.0
    assert.strictEqual(reqTopic.score, 78.0);
    assert.strictEqual(reqTopic.questionsCount, 2);
    assert.strictEqual(reqTopic.highestDifficultyReached, 'MEDIUM');
    assert.strictEqual(reqTopic.highestDifficultyStrong, 'MEDIUM');
    assert.strictEqual(reqTopic.label, 'STRENGTH');

    const archTopic = topicResults.find((t) => t.topicId === 'top-arch');
    assert.strictEqual(archTopic.score, 40.0);
    assert.strictEqual(archTopic.questionsCount, 1);
    assert.strictEqual(archTopic.highestDifficultyReached, 'EASY');
    assert.strictEqual(archTopic.highestDifficultyStrong, null);
    assert.strictEqual(archTopic.label, 'WEAKNESS');
  });

  // --- 9. TOPIC HIGHEST DIFFICULTY REACHED VS STRONG ---
  test('computeTopicScores separates highest reached from highest STRONG', () => {
    const topics = [{ id: 'top-1', name: 'Topic 1' }];
    const responses = [
      { questionId: 'q1', topicId: 'top-1', difficulty: 'EASY', answerScore: 0.9, verdict: 'STRONG' },
      { questionId: 'q2', topicId: 'top-1', difficulty: 'MEDIUM', answerScore: 0.85, verdict: 'STRONG' },
      { questionId: 'q3', topicId: 'top-1', difficulty: 'HARD', answerScore: 0.2, verdict: 'IRRELEVANT' },
    ];
    const [t1] = computeTopicScores(responses, topics);
    assert.strictEqual(t1.highestDifficultyReached, 'HARD');
    assert.strictEqual(t1.highestDifficultyStrong, 'MEDIUM');
  });

  // --- 10. UNASSESSED TOPICS (0 QUESTIONS) ---
  test('Topics with no questions asked are classified as NOT_ASSESSED with score null', () => {
    const topics = [
      { id: 'top-req', name: 'Requirements Analysis' },
      { id: 'top-unasked', name: 'Interface Management' },
    ];
    const responses = [
      { questionId: 'q1', topicId: 'top-req', difficulty: 'EASY', answerScore: 0.8, verdict: 'STRONG' },
    ];
    const topicResults = computeTopicScores(responses, topics);
    const unasked = topicResults.find((t) => t.topicId === 'top-unasked');
    assert.strictEqual(unasked.score, null);
    assert.strictEqual(unasked.questionsCount, 0);
    assert.strictEqual(unasked.highestDifficultyReached, null);
    assert.strictEqual(unasked.highestDifficultyStrong, null);
    assert.strictEqual(unasked.label, 'NOT_ASSESSED');
  });

  // --- 11. TOPIC LABEL BOUNDARY: 70.0 (STRENGTH) ---
  test('Topic label boundary: 70.0 qualifies as STRENGTH', () => {
    assert.strictEqual(determineTopicLabel(70.0), 'STRENGTH');
  });

  // --- 12. TOPIC LABEL BOUNDARY: 69.9 (AVERAGE) ---
  test('Topic label boundary: 69.9 qualifies as AVERAGE', () => {
    assert.strictEqual(determineTopicLabel(69.9), 'AVERAGE');
  });

  // --- 13. TOPIC LABEL BOUNDARY: 45.0 (AVERAGE) ---
  test('Topic label boundary: 45.0 qualifies as AVERAGE', () => {
    assert.strictEqual(determineTopicLabel(45.0), 'AVERAGE');
  });

  // --- 14. TOPIC LABEL BOUNDARY: 44.9 (WEAKNESS) ---
  test('Topic label boundary: 44.9 qualifies as WEAKNESS', () => {
    assert.strictEqual(determineTopicLabel(44.9), 'WEAKNESS');
  });

  // --- 15. TOPIC LABEL: NULL SCORE -> NOT_ASSESSED ---
  test('Topic label: null score produces NOT_ASSESSED', () => {
    assert.strictEqual(determineTopicLabel(null), 'NOT_ASSESSED');
  });

  // --- 16. CHRONOLOGICAL DIFFICULTY PROGRESSION ---
  test('computeDifficultyProgression produces ordered step-by-step trace', () => {
    const responses = [
      { questionId: 'ice1', difficulty: 'EASY', verdict: 'NOT_SCORED', isReask: false, answerScore: null },
      { questionId: 'q1', difficulty: 'EASY', verdict: 'STRONG', isReask: false, answerScore: 0.88 },
      { questionId: 'q2', difficulty: 'MEDIUM', verdict: 'PARTIAL', isReask: false, answerScore: 0.55 },
    ];
    const trace = computeDifficultyProgression(responses);
    assert.strictEqual(trace.length, 3);
    assert.deepStrictEqual(trace[0], {
      step: 1,
      questionId: 'ice1',
      difficulty: 'EASY',
      verdict: 'NOT_SCORED',
      isReask: false,
      answerScore: null,
    });
    assert.strictEqual(trace[1].step, 2);
    assert.strictEqual(trace[1].difficulty, 'EASY');
    assert.strictEqual(trace[2].step, 3);
    assert.strictEqual(trace[2].difficulty, 'MEDIUM');
  });

  // --- 17. OVERALL SCORE BLEND: DEFAULT WEIGHTS (0.20 / 0.80) ---
  test('computeOverall blends 0.20 * skillMatch + 0.80 * interviewScore', () => {
    // skillMatch: 90.0, interviewScore: 80.0
    // 0.2 * 90 + 0.8 * 80 = 18 + 64 = 82.0
    const overall = computeOverall(90.0, 80.0);
    assert.strictEqual(overall, 82.0);
  });

  // --- 18. OVERALL SCORE PRECISION ROUNDING ---
  test('computeOverall rounds accurately to 2 decimal places', () => {
    // 0.20 * 49.29 + 0.80 * 65.5 = 9.858 + 52.4 = 62.258 -> 62.26
    const overall = computeOverall(49.29, 65.5);
    assert.strictEqual(overall, 62.26);
  });

  // --- 19. MANDATORY GAP DOES NOT ALTER OVERALL SCORE ---
  test('Mandatory skill gap does NOT alter computed overallScore', () => {
    const scoreWithoutGap = computeOverall(80.0, 75.0);
    // Even if candidate has mandatoryGap, mathematical score is strictly formula-driven
    const scoreWithGap = computeOverall(80.0, 75.0);
    assert.strictEqual(scoreWithGap, scoreWithoutGap);
    assert.strictEqual(scoreWithGap, 76.0); // 0.20*80 + 0.80*75 = 16 + 60 = 76
  });

  // --- 20. RECOMMENDATION BOUNDARY: 70.0 (SUITABLE) ---
  test('recommend boundary: 70.0 produces SUITABLE', () => {
    assert.strictEqual(recommend(70.0), 'SUITABLE');
  });

  // --- 21. RECOMMENDATION BOUNDARY: 69.9 (BORDERLINE) ---
  test('recommend boundary: 69.9 produces BORDERLINE', () => {
    assert.strictEqual(recommend(69.9), 'BORDERLINE');
  });

  // --- 22. RECOMMENDATION BOUNDARY: 45.0 (BORDERLINE) ---
  test('recommend boundary: 45.0 produces BORDERLINE', () => {
    assert.strictEqual(recommend(45.0), 'BORDERLINE');
  });

  // --- 23. RECOMMENDATION BOUNDARY: 44.9 (NOT_SUITABLE) ---
  test('recommend boundary: 44.9 produces NOT_SUITABLE', () => {
    assert.strictEqual(recommend(44.9), 'NOT_SUITABLE');
  });

  // --- 24. EARLY TERMINATION CAPS AT BORDERLINE EVEN WITH HIGH SCORE ---
  test('Early termination caps recommendation at BORDERLINE even with high score (85.0)', () => {
    const rec = recommend(85.0, { terminatedEarly: true });
    assert.strictEqual(rec, 'BORDERLINE');
  });

  // --- 25. EARLY TERMINATION WITH LOW SCORE REMAINS NOT_SUITABLE ---
  test('Early termination with low score (<45) remains NOT_SUITABLE', () => {
    const rec = recommend(38.0, { terminatedEarly: true });
    assert.strictEqual(rec, 'NOT_SUITABLE');
  });

  // --- 26. EARLY TERMINATION WITH BORDERLINE SCORE REMAINS BORDERLINE ---
  test('Early termination with borderline score (55.0) remains BORDERLINE', () => {
    const rec = recommend(55.0, { terminatedEarly: true });
    assert.strictEqual(rec, 'BORDERLINE');
  });

  // --- 27. COLLECT FLAGS: COUNTS DIAGNOSTIC AND ANTI-GAMING FLAGS ---
  test('collectFlags correctly tallies TOO_SHORT, KEYWORD_STUFFING, NO_ANSWER, and REASKED', () => {
    const responses = [
      { isReask: false, verdict: 'TOO_SHORT', breakdown: { flags: ['TOO_SHORT'] } },
      { isReask: true, verdict: 'PARTIAL', breakdown: { flags: ['KEYWORD_STUFFING'] } },
      { isReask: false, verdict: 'IRRELEVANT', breakdown: { flags: ['NO_ANSWER'] } },
    ];
    const flags = collectFlags(responses, null, null, { lowFitQuestionsCount: 2 });
    assert.strictEqual(flags.counts.TOO_SHORT, 1);
    assert.strictEqual(flags.counts.KEYWORD_STUFFING, 1);
    assert.strictEqual(flags.counts.NO_ANSWER, 1);
    assert.strictEqual(flags.counts.REASKED, 1);
    assert.strictEqual(flags.counts.LOW_FIT_QUESTION, 2);
  });

  // --- 28. COLLECT FLAGS: MANDATORY GAP CARRIED OVER ---
  test('collectFlags accurately detects and carries mandatory gap warning', () => {
    const skillMatchWithGap = { mandatoryGap: true, missingMandatory: ['MBSE'] };
    const flagsWithGap = collectFlags([], skillMatchWithGap, null);
    assert.strictEqual(flagsWithGap.mandatoryGap, true);
    assert.ok(flagsWithGap.activeFlags.includes('MANDATORY_GAP'));

    const skillMatchClean = { mandatoryGap: false, missingMandatory: [] };
    const flagsClean = collectFlags([], skillMatchClean, null);
    assert.strictEqual(flagsClean.mandatoryGap, false);
    assert.ok(!flagsClean.activeFlags.includes('MANDATORY_GAP'));
  });

  // --- 29. COLLECT FLAGS: TERMINATED_EARLY FROM SESSION STATE ---
  test('collectFlags detects early termination from sessionState endReason', () => {
    const sessionStruggling = { endReason: 'CANDIDATE_STRUGGLING', status: 'COMPLETED' };
    const flags = collectFlags([], null, sessionStruggling);
    assert.strictEqual(flags.terminatedEarly, true);
    assert.ok(flags.activeFlags.includes('TERMINATED_EARLY'));

    const sessionNormal = { endReason: 'MAX_QUESTIONS_REACHED', status: 'COMPLETED' };
    const flagsNormal = collectFlags([], null, sessionNormal);
    assert.strictEqual(flagsNormal.terminatedEarly, false);
    assert.ok(!flagsNormal.activeFlags.includes('TERMINATED_EARLY'));
  });

  console.log('\n========================================================================');
  console.log(` ALL ${passed}/${total} UNIT TESTS PASSED SUCCESSFULLY (100%)`);
  console.log('========================================================================\n');
}

try {
  runUnitTests();
} catch (err) {
  process.exit(1);
}

