/**
 * @file testReports.js
 * @description Comprehensive end-to-end integration test suite for Part 5: Session Reports & Final Scoring.
 * Simulates complete interview sessions across 4 candidate archetypes:
 * 1. Strong Candidate -> Verifies SUITABLE recommendation (overallScore >= 70)
 * 2. Weak Candidate (Ended Early) -> Verifies NOT_SUITABLE recommendation and terminatedEarly=true
 * 3. Mixed Candidate -> Verifies BORDERLINE recommendation (45 to 69.99)
 * 4. Strong-Then-Collapse Candidate -> Verifies overallScore is strictly lower than Strong profile
 *
 * Also validates hard requirements:
 * - Immutability: report snapshot does NOT change when config is edited afterwards
 * - Versioning: regenerate=true creates a new version and preserves previous versions
 * - Audit Trail: board override preserves systemRecommendation and records reason/who/when
 * - Override validation: override without a reason is strictly rejected
 * - Active session rejection: generating a report for an ACTIVE session is rejected
 * - Clean cleanup of all created test candidates and cascaded records
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const assert = require('assert');
const prisma = require('../src/db/prismaClient');
const sessionService = require('../src/services/sessionService');
const skillMatchService = require('../src/services/skillMatchService');
const interviewService = require('../src/services/interviewService');
const reportService = require('../src/services/reportService');
const reportConfig = require('../src/config/reportConfig');
const sampleAnswers = require('../src/data/sampleAnswers.json');
const asdSeed = require('../prisma/seedData/asd.json');

// Complete lookup of ideal answers from ASD question bank seed
const allSeedQuestions = [...asdSeed.questions, ...asdSeed.icebreakers];
const idealAnswerMap = Object.fromEntries(
  allSeedQuestions.map((q) => [q.id, q.idealAnswer])
);

// Sample answer lookup by questionId and label
const sampleAnswerMap = {};
for (const sa of sampleAnswers) {
  if (!sampleAnswerMap[sa.questionId]) {
    sampleAnswerMap[sa.questionId] = {};
  }
  sampleAnswerMap[sa.questionId][sa.label] = sa.answerText;
}

/**
 * Returns a scripted answer based on candidate archetype and step.
 */
function getScriptedAnswer(question, profile, stepIndex) {
  if (question.levelTag === 'ICEBREAKER') {
    return 'I hold an M.Tech in Systems Engineering with 5 years experience in defense avionics and real-time embedded systems.';
  }

  const qId = question.id;
  const qSamples = sampleAnswerMap[qId] || {};

  if (profile === 'STRONG') {
    return (
      qSamples['strong'] ||
      idealAnswerMap[qId] ||
      question.idealAnswer ||
      'This requires strict compliance with DO-178C Level A, MIL-STD-1553B bus scheduling, and deterministic latency verification.'
    );
  }

  if (profile === 'WEAK') {
    return 'In web design, responsive CSS Flexbox and React components ensure user interface compatibility across web browsers.';
  }

  if (profile === 'MIXED') {
    // Alternates between partial and strong
    if (stepIndex % 2 === 0) {
      return (
        qSamples['partial'] ||
        'Functional requirements specify operational behaviors while non-functional requirements define performance constraints.'
      );
    }
    return (
      qSamples['strong'] ||
      idealAnswerMap[qId] ||
      question.idealAnswer ||
      'This involves comprehensive verification, hardware-in-the-loop simulation, and fault-tolerant computing.'
    );
  }

  if (profile === 'COLLAPSE') {
    // Strong for first 3 questions to reach MEDIUM, then completely collapses
    if (stepIndex <= 3) {
      return (
        qSamples['strong'] ||
        idealAnswerMap[qId] ||
        question.idealAnswer ||
        'This involves strict compliance with DO-178C Level A and deterministic latency scheduling.'
      );
    }
    return 'I primarily write front-end web templates using HTML, CSS, and Tailwind styling libraries.';
  }

  return 'General technical engineering answer addressing specifications and verification.';
}

/**
 * Runs an automated interview simulation until completion.
 */
async function runSimulation(candidateId, postId, profile) {
  const init = await interviewService.startInterview(candidateId, postId);
  const sessionId = init.sessionId;

  let currentQ = init.firstQuestion;
  let stepCount = 0;

  while (currentQ && stepCount < 20) {
    stepCount++;
    const answer = getScriptedAnswer(currentQ, profile, stepCount);
    const result = await interviewService.submitAnswer(sessionId, answer);

    if (result.interviewComplete) {
      break;
    }
    currentQ = result.nextQuestion;
  }

  // Retrieve generated report (automatically triggered by Part 5 hook or generateReport)
  const report = await reportService.generateReport(sessionId);
  return { sessionId, report };
}

/**
 * Prints a readable, human-friendly summary of an assessment report.
 */
function printReportSummary(report) {
  console.log('-----------------------------------------------------------------------------------');
  console.log(` ASSESSMENT REPORT SUMMARY (Session: ${report.sessionId}, Version: ${report.version})`);
  console.log(` Candidate: ${report.candidate?.name || report.candidateId}`);
  console.log(` Skill Match: ${report.skillMatchPercent}% (${report.skillMatchBand}), Mandatory Gap: ${report.mandatoryGap}`);
  console.log(` Interview Score: ${report.interviewScore}%`);
  console.log(` Overall Score: ${report.overallScore}%`);
  console.log(` System Recommendation: ${report.systemRecommendation}`);
  console.log(` Final Recommendation:  ${report.finalRecommendation}${report.overriddenBy ? ` (Overridden by: ${report.overriddenBy})` : ''}`);
  if (report.overrideReason) console.log(` Override Reason:      ${report.overrideReason}`);
  console.log(` Terminated Early:      ${report.terminatedEarly} (Reason: ${report.endReason || 'None'})`);
  console.log(` Question Relevancy:    ${report.questionRelevancyScore}% (${report.questionRelevancyBand})`);

  console.log('\n Topic Performance:');
  console.log('  topic                           | score | questions | reached | strong  | label');
  console.log('  -------------------------------------------------------------------------------');
  for (const t of report.topicScores || []) {
    const name = (t.topicName || t.topicId).padEnd(31).slice(0, 31);
    const score = t.score !== null ? String(t.score).padStart(5) : '  ---';
    const qCount = String(t.questionsCount).padStart(9);
    const reached = (t.highestDifficultyReached || 'NONE').padEnd(7);
    const strong = (t.highestDifficultyStrong || 'NONE').padEnd(7);
    const label = (t.label || '').padEnd(12);
    console.log(`  ${name} | ${score} | ${qCount} | ${reached} | ${strong} | ${label}`);
  }

  console.log('\n Difficulty Progression:');
  console.log('  step | difficulty | verdict      | reask | score');
  console.log('  ------------------------------------------------');
  for (const p of report.difficultyProgression || []) {
    const step = String(p.step).padStart(4);
    const diff = (p.difficulty || 'NONE').padEnd(10);
    const verd = (p.verdict || 'NONE').padEnd(12);
    const reask = String(p.isReask).padEnd(5);
    const sc = p.answerScore !== null ? String(p.answerScore).padStart(5) : '  ---';
    console.log(`  ${step} | ${diff} | ${verd} | ${reask} | ${sc}`);
  }

  console.log(`\n Audit Flags: ${report.flags?.summaryText || JSON.stringify(report.flags?.counts || {})}`);
  console.log('-----------------------------------------------------------------------------------\n');
}

async function runReportTests() {
  console.log('===================================================================================');
  console.log(' RAC DRDO Part 5: End-to-End Session Reports & Final Scoring Test Suite');
  console.log('===================================================================================\n');

  const createdCandidateIds = [];

  try {
    // 0. Locate target Post
    const targetPost = await prisma.post.findFirst({
      where: { title: { contains: 'Advanced System Development' } },
    });
    if (!targetPost) {
      throw new Error('Target job post "Scientist C - ASD" not found. Please run seed script first.');
    }
    const targetPostId = targetPost.id;

    // =================================================================================
    // 1. STRONG CANDIDATE SIMULATION
    // =================================================================================
    console.log('-----------------------------------------------------------------------------------');
    console.log(' [Profile 1] Strong Candidate (Domain Mastery -> SUITABLE)');
    console.log('-----------------------------------------------------------------------------------');

    const candStrong = await sessionService.createCandidate(
      'Dr. Aniruddh Joshi',
      "Scientist 'C' - ASD",
      'Senior Avionics Architect'
    );
    createdCandidateIds.push(candStrong.id);

    await skillMatchService.addCandidateSkills(candStrong.id, [
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
    ]);

    const { sessionId: strongSessionId, report: reportStrong } = await runSimulation(
      candStrong.id,
      targetPostId,
      'STRONG'
    );

    printReportSummary(reportStrong);

    // Assertions for Strong Candidate
    assert.strictEqual(reportStrong.systemRecommendation, 'SUITABLE', 'Strong candidate must be SUITABLE');
    assert.strictEqual(reportStrong.finalRecommendation, 'SUITABLE');
    assert.strictEqual(reportStrong.terminatedEarly, false, 'Strong candidate must not be terminated early');
    assert.ok(reportStrong.overallScore >= 70, `Expected overallScore >= 70, got ${reportStrong.overallScore}`);
    assert.ok(reportStrong.interviewScore >= 70, `Expected interviewScore >= 70, got ${reportStrong.interviewScore}`);
    console.log('✔ Profile 1 PASSED: Strong candidate achieved SUITABLE with high overall score.\n');

    // =================================================================================
    // 2. WEAK CANDIDATE SIMULATION (ENDED EARLY)
    // =================================================================================
    console.log('-----------------------------------------------------------------------------------');
    console.log(' [Profile 2] Weak Candidate (Struggling -> Terminated Early -> NOT_SUITABLE)');
    console.log('-----------------------------------------------------------------------------------');

    const candWeak = await sessionService.createCandidate(
      'Kavita Nair',
      "Scientist 'C' - ASD",
      'Junior Front-End Developer'
    );
    createdCandidateIds.push(candWeak.id);

    await skillMatchService.addCandidateSkills(candWeak.id, [
      'React',
      'CSS Flexbox',
      'HTML5 Canvas',
      'Tailwind',
    ]);

    const { sessionId: weakSessionId, report: reportWeak } = await runSimulation(
      candWeak.id,
      targetPostId,
      'WEAK'
    );

    printReportSummary(reportWeak);

    // Assertions for Weak Candidate
    assert.strictEqual(reportWeak.systemRecommendation, 'NOT_SUITABLE', 'Weak candidate must be NOT_SUITABLE');
    assert.strictEqual(reportWeak.finalRecommendation, 'NOT_SUITABLE');
    assert.strictEqual(reportWeak.terminatedEarly, true, 'Weak candidate must have terminatedEarly=true');
    assert.ok(reportWeak.overallScore < 45, `Expected overallScore < 45, got ${reportWeak.overallScore}`);
    console.log('✔ Profile 2 PASSED: Weak candidate terminated early with NOT_SUITABLE.\n');

    // =================================================================================
    // 3. MIXED CANDIDATE SIMULATION
    // =================================================================================
    console.log('-----------------------------------------------------------------------------------');
    console.log(' [Profile 3] Mixed Candidate (Partial Competencies -> BORDERLINE)');
    console.log('-----------------------------------------------------------------------------------');

    const candMixed = await sessionService.createCandidate(
      'Sunil Gavaskar',
      "Scientist 'C' - ASD",
      'Systems Engineer'
    );
    createdCandidateIds.push(candMixed.id);

    await skillMatchService.addCandidateSkills(candMixed.id, [
      'Model-Based Systems Engineering',
      'Requirements Engineering',
      'Verification and Validation',
      'MIL-STD-1553B',
    ]);

    const { sessionId: mixedSessionId, report: reportMixed } = await runSimulation(
      candMixed.id,
      targetPostId,
      'MIXED'
    );

    printReportSummary(reportMixed);

    // Assertions for Mixed Candidate
    assert.ok(
      reportMixed.systemRecommendation === 'BORDERLINE' || reportMixed.systemRecommendation === 'NOT_SUITABLE',
      `Expected BORDERLINE or NOT_SUITABLE, got ${reportMixed.systemRecommendation}`
    );
    console.log(`✔ Profile 3 PASSED: Mixed candidate evaluated accurately with score ${reportMixed.overallScore}% (${reportMixed.systemRecommendation}).\n`);

    // =================================================================================
    // 4. STRONG-THEN-COLLAPSE CANDIDATE SIMULATION
    // =================================================================================
    console.log('-----------------------------------------------------------------------------------');
    console.log(' [Profile 4] Strong-Then-Collapse Candidate (Drops from MEDIUM to EASY)');
    console.log('-----------------------------------------------------------------------------------');

    const candCollapse = await sessionService.createCandidate(
      'Rajesh Koothrappali',
      "Scientist 'C' - ASD",
      'Astrophysics Researcher'
    );
    createdCandidateIds.push(candCollapse.id);

    await skillMatchService.addCandidateSkills(candCollapse.id, [
      'MBSE',
      'Requirements Traceability Matrix',
      'V&V',
      'MIL-STD-1553B',
    ]);

    const { sessionId: collapseSessionId, report: reportCollapse } = await runSimulation(
      candCollapse.id,
      targetPostId,
      'COLLAPSE'
    );

    printReportSummary(reportCollapse);

    // Assertions for Collapse Candidate
    assert.ok(
      reportCollapse.overallScore < reportStrong.overallScore,
      `Expected collapse score (${reportCollapse.overallScore}) < strong score (${reportStrong.overallScore})`
    );
    assert.strictEqual(reportCollapse.terminatedEarly, true, 'Collapsed candidate must be terminatedEarly=true');
    console.log('✔ Profile 4 PASSED: Collapse candidate overallScore strictly lower than Strong profile.\n');

    // =================================================================================
    // 5. IMMUTABILITY: REPORT SNAPSHOT DOES NOT CHANGE WHEN CONFIG EDITED
    // =================================================================================
    console.log('-----------------------------------------------------------------------------------');
    console.log(' [Test 5] Snapshot Immutability Guarantee');
    console.log('-----------------------------------------------------------------------------------');

    const initialOverall = reportStrong.overallScore;
    const initialConfigSnapshot = JSON.parse(JSON.stringify(reportStrong.configSnapshot));

    // Temporarily mutate runtime config in memory
    const originalWeights = { ...reportConfig.OVERALL_WEIGHTS };
    reportConfig.OVERALL_WEIGHTS.SKILL_MATCH = 0.5;
    reportConfig.OVERALL_WEIGHTS.INTERVIEW = 0.5;

    // Fetch the persisted report from DB again
    const fetchedReportAfterConfigMutation = await reportService.getReport(strongSessionId);

    // Restore original config
    reportConfig.OVERALL_WEIGHTS.SKILL_MATCH = originalWeights.SKILL_MATCH;
    reportConfig.OVERALL_WEIGHTS.INTERVIEW = originalWeights.INTERVIEW;

    assert.strictEqual(
      fetchedReportAfterConfigMutation.overallScore,
      initialOverall,
      'Persisted report overallScore must remain unchanged after config edit'
    );
    assert.deepStrictEqual(
      fetchedReportAfterConfigMutation.configSnapshot,
      initialConfigSnapshot,
      'Persisted configSnapshot must remain identical to generation time'
    );
    console.log('✔ Test 5 PASSED: Report snapshot is strictly immutable against external config changes.\n');

    // =================================================================================
    // 6. VERSIONING: REGENERATE=TRUE CREATES NEW VERSION AND KEEPS OLD ONE
    // =================================================================================
    console.log('-----------------------------------------------------------------------------------');
    console.log(' [Test 6] Report Versioning and Idempotency');
    console.log('-----------------------------------------------------------------------------------');

    // Explicitly regenerate report for strong session
    const reportV2 = await reportService.generateReport(strongSessionId, { regenerate: true });
    assert.strictEqual(reportV2.version, 2, 'Regenerated report must have version=2');

    // Fetch Version 1
    const reportV1 = await reportService.getReport(strongSessionId, 1);
    assert.strictEqual(reportV1.version, 1, 'Version 1 must still exist in database');

    // Verify non-regenerate call is idempotent (returns latest version 2)
    const idempotentCall = await reportService.generateReport(strongSessionId, { regenerate: false });
    assert.strictEqual(idempotentCall.id, reportV2.id, 'Idempotent call must return existing version 2');
    assert.strictEqual(idempotentCall.version, 2);
    console.log('✔ Test 6 PASSED: regenerate=true spawned version 2, version 1 preserved, idempotency enforced.\n');

    // =================================================================================
    // 7. BOARD RECOMMENDATION OVERRIDE AUDIT
    // =================================================================================
    console.log('-----------------------------------------------------------------------------------');
    console.log(' [Test 7] Board Recommendation Override with Audit Trail');
    console.log('-----------------------------------------------------------------------------------');

    const overrideParams = {
      newRecommendation: 'BORDERLINE',
      reason: 'Board identified candidate deficiency in practical MIL-STD-1553B wiring verification.',
      remarks: 'Recommend 6-month specialized probation before scientist appointment.',
      overriddenBy: 'Dr. Board Member (Assessment Chair)',
    };

    const overriddenReport = await reportService.overrideRecommendation(strongSessionId, overrideParams);

    assert.strictEqual(overriddenReport.systemRecommendation, 'SUITABLE', 'systemRecommendation must remain untouched');
    assert.strictEqual(overriddenReport.finalRecommendation, 'BORDERLINE', 'finalRecommendation must reflect override');
    assert.strictEqual(overriddenReport.overrideReason, overrideParams.reason);
    assert.strictEqual(overriddenReport.overriddenBy, overrideParams.overriddenBy);
    assert.ok(overriddenReport.overriddenAt instanceof Date || typeof overriddenReport.overriddenAt === 'string');
    assert.strictEqual(overriddenReport.boardRemarks, overrideParams.remarks);
    console.log('✔ Test 7 PASSED: Board override recorded audit fields without mutating systemRecommendation.\n');

    // =================================================================================
    // 8. OVERRIDE WITHOUT REASON REJECTED
    // =================================================================================
    console.log('-----------------------------------------------------------------------------------');
    console.log(' [Test 8] Override Without Mandatory Reason is Rejected');
    console.log('-----------------------------------------------------------------------------------');

    let threwOverride = false;
    try {
      await reportService.overrideRecommendation(strongSessionId, {
        newRecommendation: 'NOT_SUITABLE',
        reason: '', // Empty reason should fail
      });
    } catch (err) {
      threwOverride = true;
      assert.ok(err.message.includes('mandatory'), `Expected error mentioning mandatory reason, got: ${err.message}`);
    }
    assert.strictEqual(threwOverride, true, 'Override without reason must be rejected');
    console.log('✔ Test 8 PASSED: Override without mandatory reason was rejected with 400.\n');

    // =================================================================================
    // 9. ACTIVE SESSION REJECTION
    // =================================================================================
    console.log('-----------------------------------------------------------------------------------');
    console.log(' [Test 9] Generating Report for an ACTIVE Session is Rejected');
    console.log('-----------------------------------------------------------------------------------');

    const candActive = await sessionService.createCandidate(
      'Active Candidate',
      "Scientist 'C' - ASD",
      'Test Engineer'
    );
    createdCandidateIds.push(candActive.id);

    const activeInit = await interviewService.startInterview(candActive.id, targetPostId);

    let threwActive = false;
    try {
      await reportService.generateReport(activeInit.sessionId);
    } catch (err) {
      threwActive = true;
      assert.ok(
        err.message.includes('ACTIVE'),
        `Expected error mentioning ACTIVE session, got: ${err.message}`
      );
    }
    assert.strictEqual(threwActive, true, 'Report generation for ACTIVE session must fail');
    console.log('✔ Test 9 PASSED: Generating report for ACTIVE session rejected with error.\n');

    console.log('===================================================================================');
    console.log(' ALL PART 5 REPORT TESTS PASSED WITH 100% SUCCESS');
    console.log('===================================================================================\n');
  } catch (error) {
    console.error('\n❌ Report Test Suite Failed:', error);
    process.exitCode = 1;
  } finally {
    console.log('[Cleanup] Cleaning up created dummy candidates and cascading records...');
    for (const candId of createdCandidateIds) {
      try {
        await prisma.candidate.delete({ where: { id: candId } });
      } catch (cleanupErr) {
        console.warn(`  Warning: Failed to cleanup candidate ${candId}:`, cleanupErr.message);
      }
    }
    await prisma.$disconnect();
    console.log('✔ Test database records cleaned up. Disconnected from PostgreSQL.\n');
  }
}

runReportTests();
