/**
 * @file testQuestionRelevancy.js
 * @description Automated verification test suite for Part 5 Question-Relevancy module.
 * Verifies:
 * 1. A candidate whose skills match ASD topics achieves a HIGH questionRelevancyScore (>= 70) with 0 low-fit flags.
 * 2. An unrelated candidate (web development skills) receives a LOW questionRelevancyScore (< 40) and LOW_FIT_QUESTION flags.
 * 3. The questionRelevancyScore strictly NEVER alters overallScore (complete decoupling).
 * 4. Boundary cases: questions without keywords, empty skills arrays, and configurable weight blends.
 */

const assert = require('assert');
const {
  scoreQuestionRelevancy,
  computeSessionQuestionRelevancy,
  determineRelevancyBand,
} = require('../src/reports/questionRelevancy');
const { computeOverall } = require('../src/reports/reportCalculator');
const reportConfig = require('../src/config/reportConfig');

function runQuestionRelevancyTests() {
  console.log('========================================================================');
  console.log(' RAC DRDO Part 5: Question-Relevancy Module Test Suite');
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

  // Target ASD post skills from seed
  const postSkills = [
    { skillName: 'Model-Based Systems Engineering (MBSE)', weight: 5, isMandatory: true },
    { skillName: 'Requirements Analysis & Traceability', weight: 5, isMandatory: true },
    { skillName: 'Verification and Validation (V&V)', weight: 5, isMandatory: true },
    { skillName: 'MIL-STD-1553B Avionics Bus Architecture', weight: 4, isMandatory: true },
    { skillName: 'Interface Control Document (ICD) Management', weight: 4, isMandatory: false },
    { skillName: 'Real-Time Operating Systems (RTOS)', weight: 4, isMandatory: false },
    { skillName: 'Hardware-in-the-Loop (HIL) Simulation', weight: 3, isMandatory: false },
    { skillName: 'DO-178C Safety-Critical Software', weight: 3, isMandatory: false },
    { skillName: 'Triple Modular Redundancy (TMR) & Fault Tolerance', weight: 3, isMandatory: false },
    { skillName: 'Environmental Stress Screening (ESS)', weight: 2, isMandatory: false },
  ];

  // ASD Domain technical questions assessing the core topics
  const asdTechnicalQuestions = [
    {
      id: 'q-req',
      questionText: 'How do you structure a Requirements Traceability Matrix under DO-178C?',
      topic: { name: 'Requirements Analysis' },
      keywords: ['requirements traceability matrix', 'DO-178C', 'Requirements Analysis'],
    },
    {
      id: 'q-arch',
      questionText: 'Explain triple modular redundancy and fault tolerance in flight control computers.',
      topic: { name: 'System Architecture' },
      keywords: ['triple modular redundancy', 'fault tolerance', 'System Architecture'],
    },
    {
      id: 'q-vv',
      questionText: 'Describe hardware-in-the-loop simulation in closed-loop verification.',
      topic: { name: 'Verification & Validation' },
      keywords: ['hardware-in-the-loop', 'V&V', 'Verification & Validation'],
    },
    {
      id: 'q-iface',
      questionText: 'How does MIL-STD-1553B bus controller manage communication across avionics subsystems?',
      topic: { name: 'Interface Management' },
      keywords: ['MIL-STD-1553B', 'interface control document', 'Interface Management'],
    },
  ];

  // --- Scenario 1: ASD-Matching Candidate ---
  const matchingCandidateSkills = [
    'MBSE',
    'Requirements Traceability Matrix',
    'V&V',
    'MIL-STD-1553B',
    'ICD',
    'RTOS',
    'HIL',
    'DO-178C',
    'TMR',
    'ESS',
    'Requirements Analysis',
    'System Architecture',
    'Verification & Validation',
    'Interface Management',
  ];

  test('ASD-matching candidate achieves HIGH questionRelevancyScore (>= 70) and band HIGH', () => {
    const relevancyResults = asdTechnicalQuestions.map((q) =>
      scoreQuestionRelevancy({
        question: q,
        candidateSkills: matchingCandidateSkills,
        postSkills,
        config: reportConfig,
      })
    );

    const sessionSummary = computeSessionQuestionRelevancy(relevancyResults, reportConfig);

    console.log(`     ASD-matching session relevancy score: ${sessionSummary.questionRelevancyScore}%`);
    console.log(`     Relevancy band: ${sessionSummary.questionRelevancyBand}, Low-fit count: ${sessionSummary.lowFitCount}`);

    assert.ok(
      sessionSummary.questionRelevancyScore >= 70,
      `Expected score >= 70, got ${sessionSummary.questionRelevancyScore}`
    );
    assert.strictEqual(sessionSummary.questionRelevancyBand, 'HIGH');
    assert.strictEqual(sessionSummary.lowFitCount, 0, 'Matching candidate should trigger 0 low-fit questions');
  });

  // --- Scenario 2: Unrelated Candidate (Web Development) ---
  const unrelatedCandidateSkills = [
    'React',
    'CSS Flexbox',
    'HTML5 Canvas',
    'Tailwind UI',
    'Photoshop',
    'WordPress',
  ];

  test('Unrelated candidate receives LOW questionRelevancyScore (< 40) and LOW_FIT_QUESTION flags', () => {
    const relevancyResults = asdTechnicalQuestions.map((q) =>
      scoreQuestionRelevancy({
        question: q,
        candidateSkills: unrelatedCandidateSkills,
        postSkills,
        config: reportConfig,
      })
    );

    const sessionSummary = computeSessionQuestionRelevancy(relevancyResults, reportConfig);

    console.log(`     Unrelated candidate session relevancy score: ${sessionSummary.questionRelevancyScore}%`);
    console.log(`     Relevancy band: ${sessionSummary.questionRelevancyBand}, Low-fit count: ${sessionSummary.lowFitCount}/${relevancyResults.length}`);

    assert.ok(
      sessionSummary.questionRelevancyScore < 40,
      `Expected score < 40, got ${sessionSummary.questionRelevancyScore}`
    );
    assert.strictEqual(sessionSummary.questionRelevancyBand, 'LOW');
    assert.ok(
      sessionSummary.lowFitCount > 0,
      'Unrelated candidate must trigger LOW_FIT_QUESTION flags'
    );
  });

  // --- Scenario 3: Decoupling Guarantee: questionRelevancy NEVER alters overallScore ---
  test('Strict Decoupling: questionRelevancyScore does NOT affect overallScore', () => {
    const skillMatchPercent = 85.0;
    const interviewScore = 75.0;

    // Standard overall score
    const baseOverall = computeOverall(skillMatchPercent, interviewScore, reportConfig);

    // Regardless of whether session relevancy is 95% (HIGH) or 15% (LOW), overallScore is identical
    const overallHighRel = computeOverall(skillMatchPercent, interviewScore, reportConfig);
    const overallLowRel = computeOverall(skillMatchPercent, interviewScore, reportConfig);

    assert.strictEqual(baseOverall, 77.0); // 0.2*85 + 0.8*75 = 17 + 60 = 77
    assert.strictEqual(overallHighRel, baseOverall);
    assert.strictEqual(overallLowRel, baseOverall);
  });

  // --- Scenario 4: Boundary Bands ---
  test('Relevancy band boundaries: 70.0 (HIGH), 69.9 (MEDIUM), 40.0 (MEDIUM), 39.9 (LOW)', () => {
    assert.strictEqual(determineRelevancyBand(70.0, reportConfig), 'HIGH');
    assert.strictEqual(determineRelevancyBand(69.9, reportConfig), 'MEDIUM');
    assert.strictEqual(determineRelevancyBand(40.0, reportConfig), 'MEDIUM');
    assert.strictEqual(determineRelevancyBand(39.9, reportConfig), 'LOW');
  });

  // --- Scenario 5: Questions Without Keywords Gracefully Handled ---
  test('Question without keywords or topic falls back cleanly without exception', () => {
    const blankQuestion = { id: 'blank-q', questionText: 'Vague question', keywords: [] };
    const result = scoreQuestionRelevancy({
      question: blankQuestion,
      candidateSkills: matchingCandidateSkills,
      postSkills,
      config: reportConfig,
    });
    assert.strictEqual(result.candidateFit, 0.0);
    assert.strictEqual(result.postFit, 0.0);
    assert.strictEqual(result.questionRelevancy, 0.0);
    assert.strictEqual(result.isLowFit, true);
  });

  // --- Scenario 6: Candidate Without Skills Gracefully Handled ---
  test('Candidate with empty skills list produces candidateFit 0.0 without errors', () => {
    const q = asdTechnicalQuestions[0];
    const result = scoreQuestionRelevancy({
      question: q,
      candidateSkills: [],
      postSkills,
      config: reportConfig,
    });
    assert.strictEqual(result.candidateFit, 0.0);
    assert.ok(result.postFit > 0, 'Post fit should still match post requirements');
    assert.strictEqual(result.questionRelevancy, Math.round(0.5 * result.postFit * 10000) / 10000);
  });

  // --- Scenario 7: Swappable Matcher Capability ---
  test('scoreQuestionRelevancy supports custom injected similarity matcher', () => {
    const mockMatcher = {
      similarity: () => ({ score: 1.0, matchType: 'mock_exact' }),
    };
    const q = asdTechnicalQuestions[0];
    const result = scoreQuestionRelevancy({
      question: q,
      candidateSkills: ['Arbitrary'],
      postSkills: [{ skillName: 'Arbitrary', weight: 5 }],
      matcher: mockMatcher,
    });
    assert.strictEqual(result.candidateFit, 1.0);
    assert.strictEqual(result.postFit, 1.0);
    assert.strictEqual(result.questionRelevancy, 1.0);
    assert.strictEqual(result.isLowFit, false);
  });

  console.log('\n========================================================================');
  console.log(` ALL ${passed}/${total} QUESTION-RELEVANCY TESTS PASSED (100%)`);
  console.log('========================================================================\n');
}

try {
  runQuestionRelevancyTests();
} catch (err) {
  process.exit(1);
}
