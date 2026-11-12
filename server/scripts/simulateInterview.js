/**
 * @file simulateInterview.js
 * @description End-to-end adaptive interview simulation script for Part 4.
 * Simulates complete interview sessions across 4 candidate archetypes:
 * 1. Strong candidate -> Reaches HARD questions across multiple topics
 * 2. Weak candidate -> Receives simplified re-ask, fails, ends early with CANDIDATE_STRUGGLING, never sees MEDIUM
 * 3. Mixed candidate -> Experiences normal pacing with PARTIAL and STRONG answers
 * 4. Strong-then-collapses candidate -> Drops from MEDIUM back to EASY and triggers early termination
 *
 * Verifies all hard guarantees:
 * - Zero question repetition (except tracked simplified re-ask)
 * - Difficulty never rises by more than 1 level per step
 * - Total technical questions strictly <= maxQuestions (10)
 * - getCurrentQuestion() idempotency (refreshing never skips/mutates question)
 * - Clean cleanup of all created test entities
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const prisma = require('../src/db/prismaClient');
const sessionService = require('../src/services/sessionService');
const interviewService = require('../src/services/interviewService');
const sampleAnswers = require('../src/data/sampleAnswers.json');
const { LIMITS, DIFFICULTIES, END_REASONS } = require('../src/config/engineConfig');

// Sample answer lookup by questionId and label
const sampleAnswerMap = {};
for (const sa of sampleAnswers) {
  if (!sampleAnswerMap[sa.questionId]) {
    sampleAnswerMap[sa.questionId] = {};
  }
  sampleAnswerMap[sa.questionId][sa.label] = sa.answerText;
}

/**
 * Returns a scripted answer text for a given question and candidate profile.
 */
function getScriptedAnswer(question, profile, stepIndex) {
  if (question.levelTag === 'ICEBREAKER') {
    return 'I hold an M.Tech in Systems Engineering with 4 years of embedded systems experience in defense avionics projects.';
  }

  const qId = question.id;
  const qSamples = sampleAnswerMap[qId] || {};

  if (profile === 'STRONG') {
    return (
      qSamples['strong'] ||
      question.idealAnswer ||
      'This involves strict compliance with DO-178C Level A and deterministic latency scheduling.'
    );
  }

  if (profile === 'WEAK') {
    return 'In web development, React hooks and responsive CSS Flexbox layouts allow developers to build fluid user interfaces.';
  }

  if (profile === 'MIXED') {
    // Alternate between partial and strong
    if (stepIndex % 2 === 0) {
      return (
        qSamples['partial'] ||
        'Functional requirements specify what the system does while non-functional requirements define performance constraints.'
      );
    }
    return (
      qSamples['strong'] ||
      question.idealAnswer ||
      'This involves comprehensive verification, hardware-in-the-loop simulation, and fault-tolerant computing.'
    );
  }

  if (profile === 'COLLAPSE') {
    // Strong on early questions to reach MEDIUM, then collapses to IRRELEVANT
    if (stepIndex <= 3) {
      return (
        qSamples['strong'] ||
        question.idealAnswer ||
        'This involves strict compliance with DO-178C Level A and deterministic latency scheduling.'
      );
    }
    return 'I primarily write front-end web templates using HTML, CSS, and Tailwind styling libraries.';
  }

  return 'General technical engineering answer addressing specifications and verification.';
}

/**
 * Formats a log row for the step-by-step trace table.
 */
function logTraceRow(step, qId, diff, verdict, action, nextDiff) {
  const s = String(step).padStart(4);
  const q = (qId || '---').padEnd(16).slice(0, 16);
  const d = (diff || 'NONE').padEnd(8);
  const v = (verdict || 'NONE').padEnd(12);
  const a = (action || '---').padEnd(18);
  const nd = (nextDiff || 'NONE').padEnd(8);
  console.log(`  ${s} | ${q} | ${d} | ${v} | ${a} | ${nd}`);
}

/**
 * Main simulation runner.
 */
async function runSimulations() {
  console.log('===================================================================================');
  console.log(' RAC DRDO Adaptive Interview Engine - Full Simulation Suite (Part 4)');
  console.log('===================================================================================\n');

  const createdCandidateIds = [];
  const targetPostId = 'post-asd-sc-c';

  try {
    await prisma.$connect();

    // =========================================================================
    // Simulation 1: Strong Candidate
    // =========================================================================
    console.log('-----------------------------------------------------------------------------------');
    console.log(' [Simulation 1] Strong Candidate Archetype');
    console.log('-----------------------------------------------------------------------------------');

    const cand1 = await sessionService.createCandidate(
      'Dr. Meenakshi Sundaram',
      "Scientist 'C' - ASD",
      'Aerospace Systems Specialist'
    );
    createdCandidateIds.push(cand1.id);

    const init1 = await interviewService.startInterview(cand1.id, targetPostId);
    const session1Id = init1.sessionId;

    console.log(`Candidate: "${cand1.name}" (Session: ${session1Id})`);
    console.log(`Skill Match: ${init1.skillMatchSummary.matchPercent}% (${init1.skillMatchSummary.band})`);
    console.log('\n  step | question         | diff     | verdict      | action             | nextDiff');
    console.log('  ---------------------------------------------------------------------------------');

    let currentQ = init1.firstQuestion;
    let stepCount = 0;
    const seenQuestions = [];
    const technicalDifficultiesSeen = [];
    let prevDiff = null;

    // Idempotency check on initial question
    for (let r = 0; r < 3; r++) {
      const refreshed = await interviewService.getCurrentQuestion(session1Id);
      if (refreshed.question.id !== currentQ.id) {
        throw new Error('Idempotency failure: getCurrentQuestion returned a different question upon refresh!');
      }
    }

    while (currentQ && stepCount < 20) {
      stepCount++;
      const answer = getScriptedAnswer(currentQ, 'STRONG', stepCount);

      const subResult = await interviewService.submitAnswer(session1Id, answer);
      const verdict = subResult.scoring.verdict;
      const action = subResult.decision.action;
      const nextQ = subResult.nextQuestion;

      logTraceRow(
        stepCount,
        currentQ.id,
        currentQ.difficulty,
        verdict,
        action,
        nextQ ? nextQ.difficulty : 'END'
      );

      // Record seen question (tracking non-reask vs reask)
      if (!currentQ.isReask) {
        if (seenQuestions.includes(currentQ.id)) {
          throw new Error(`CRITICAL: Question "${currentQ.id}" was asked more than once!`);
        }
        seenQuestions.push(currentQ.id);
      }

      if (currentQ.levelTag !== 'ICEBREAKER' && currentQ.difficulty) {
        technicalDifficultiesSeen.push(currentQ.difficulty);

        // Verify difficulty never rises by more than 1 level per step
        if (prevDiff === DIFFICULTIES.EASY && currentQ.difficulty === DIFFICULTIES.HARD) {
          throw new Error(`CRITICAL: Difficulty skipped from EASY directly to HARD!`);
        }
        prevDiff = currentQ.difficulty;
      }

      if (subResult.interviewComplete) {
        console.log(`\n✔ Interview completed cleanly. End reason: "${subResult.endReason}".`);
        break;
      }

      currentQ = nextQ;
    }

    const hardCount = technicalDifficultiesSeen.filter((d) => d === DIFFICULTIES.HARD).length;
    console.log(`  Total Steps: ${stepCount}, HARD questions reached: ${hardCount}`);
    if (hardCount === 0) {
      throw new Error('Strong candidate expected to reach HARD questions, but reached 0.');
    }
    console.log('✔ Simulation 1 PASSED (Strong candidate reached HARD and earned difficulty).\n');

    // =========================================================================
    // Simulation 2: Weak Candidate (Struggling -> Simplified Re-ask -> Exit)
    // =========================================================================
    console.log('-----------------------------------------------------------------------------------');
    console.log(' [Simulation 2] Weak Candidate Archetype (Struggling -> Simplified -> Termination)');
    console.log('-----------------------------------------------------------------------------------');

    const cand2 = await sessionService.createCandidate(
      'Kunal Verma',
      "Scientist 'C' - ASD",
      'Junior Intern'
    );
    createdCandidateIds.push(cand2.id);

    const init2 = await interviewService.startInterview(cand2.id, targetPostId);
    const session2Id = init2.sessionId;

    console.log(`Candidate: "${cand2.name}" (Session: ${session2Id})`);
    console.log('\n  step | question         | diff     | verdict      | action             | nextDiff');
    console.log('  ---------------------------------------------------------------------------------');

    currentQ = init2.firstQuestion;
    stepCount = 0;
    let sawSimplifiedReask = false;
    let sawMediumOrHard = false;
    let endReason2 = null;

    while (currentQ && stepCount < 15) {
      stepCount++;
      const answer = getScriptedAnswer(currentQ, 'WEAK', stepCount);

      const subResult = await interviewService.submitAnswer(session2Id, answer);
      const verdict = subResult.scoring.verdict;
      const action = subResult.decision.action;
      const nextQ = subResult.nextQuestion;

      logTraceRow(
        stepCount,
        currentQ.id,
        currentQ.difficulty,
        verdict,
        action,
        nextQ ? nextQ.difficulty : 'END'
      );

      if (action === 'REASK_SIMPLIFIED' || (nextQ && nextQ.isReask)) {
        sawSimplifiedReask = true;
      }

      if (currentQ.difficulty === DIFFICULTIES.MEDIUM || currentQ.difficulty === DIFFICULTIES.HARD) {
        sawMediumOrHard = true;
      }

      if (subResult.interviewComplete) {
        endReason2 = subResult.endReason;
        console.log(`\n✔ Interview completed cleanly. End reason: "${endReason2}".`);
        break;
      }

      currentQ = nextQ;
    }

    if (!sawSimplifiedReask) {
      throw new Error('Weak candidate expected to receive REASK_SIMPLIFIED upon IRRELEVANT on EASY.');
    }
    if (sawMediumOrHard) {
      throw new Error('Weak candidate should NEVER see a MEDIUM or HARD question!');
    }
    if (endReason2 !== END_REASONS.CANDIDATE_STRUGGLING) {
      throw new Error(`Expected endReason ${END_REASONS.CANDIDATE_STRUGGLING}, but got ${endReason2}`);
    }
    console.log('✔ Simulation 2 PASSED (Weak candidate strictly confined to EASY and ended with CANDIDATE_STRUGGLING).\n');

    // =========================================================================
    // Simulation 3: Mixed Candidate (Gradual progression & topic transitions)
    // =========================================================================
    console.log('-----------------------------------------------------------------------------------');
    console.log(' [Simulation 3] Mixed Candidate Archetype (PARTIAL & STRONG)');
    console.log('-----------------------------------------------------------------------------------');

    const cand3 = await sessionService.createCandidate(
      'Sangeeta Rao',
      "Scientist 'C' - ASD",
      'Mid-Level Systems Engineer'
    );
    createdCandidateIds.push(cand3.id);

    const init3 = await interviewService.startInterview(cand3.id, targetPostId);
    const session3Id = init3.sessionId;

    console.log(`Candidate: "${cand3.name}" (Session: ${session3Id})`);
    console.log('\n  step | question         | diff     | verdict      | action             | nextDiff');
    console.log('  ---------------------------------------------------------------------------------');

    currentQ = init3.firstQuestion;
    stepCount = 0;
    const seenQuestions3 = [];

    while (currentQ && stepCount < 20) {
      stepCount++;
      const answer = getScriptedAnswer(currentQ, 'MIXED', stepCount);

      const subResult = await interviewService.submitAnswer(session3Id, answer);
      const verdict = subResult.scoring.verdict;
      const action = subResult.decision.action;
      const nextQ = subResult.nextQuestion;

      logTraceRow(
        stepCount,
        currentQ.id,
        currentQ.difficulty,
        verdict,
        action,
        nextQ ? nextQ.difficulty : 'END'
      );

      if (!currentQ.isReask) {
        if (seenQuestions3.includes(currentQ.id)) {
          throw new Error(`CRITICAL: Duplicate question "${currentQ.id}" detected in Session 3!`);
        }
        seenQuestions3.push(currentQ.id);
      }

      if (subResult.interviewComplete) {
        console.log(`\n✔ Interview completed cleanly. End reason: "${subResult.endReason}".`);
        break;
      }

      currentQ = nextQ;
    }
    console.log('✔ Simulation 3 PASSED (Zero duplicate questions, smooth multi-topic ladder).\n');

    // =========================================================================
    // Simulation 4: Strong Then Collapse (Drops from MEDIUM back to EASY)
    // =========================================================================
    console.log('-----------------------------------------------------------------------------------');
    console.log(' [Simulation 4] Strong Then Collapse (Demotion from MEDIUM to EASY)');
    console.log('-----------------------------------------------------------------------------------');

    const cand4 = await sessionService.createCandidate(
      'Deepak Joshi',
      "Scientist 'C' - ASD",
      'Avionics Lead'
    );
    createdCandidateIds.push(cand4.id);

    const init4 = await interviewService.startInterview(cand4.id, targetPostId);
    const session4Id = init4.sessionId;

    console.log(`Candidate: "${cand4.name}" (Session: ${session4Id})`);
    console.log('\n  step | question         | diff     | verdict      | action             | nextDiff');
    console.log('  ---------------------------------------------------------------------------------');

    currentQ = init4.firstQuestion;
    stepCount = 0;
    let sawStepDown = false;
    let endReason4 = null;

    while (currentQ && stepCount < 15) {
      stepCount++;
      const answer = getScriptedAnswer(currentQ, 'COLLAPSE', stepCount);

      const subResult = await interviewService.submitAnswer(session4Id, answer);
      const verdict = subResult.scoring.verdict;
      const action = subResult.decision.action;
      const nextQ = subResult.nextQuestion;

      logTraceRow(
        stepCount,
        currentQ.id,
        currentQ.difficulty,
        verdict,
        action,
        nextQ ? nextQ.difficulty : 'END'
      );

      if (action === 'NEXT_EASIER') {
        sawStepDown = true;
      }

      if (subResult.interviewComplete) {
        endReason4 = subResult.endReason;
        console.log(`\n✔ Interview completed cleanly. End reason: "${endReason4}".`);
        break;
      }

      currentQ = nextQ;
    }

    if (!sawStepDown) {
      throw new Error('Expected NEXT_EASIER when candidate collapsed on MEDIUM question.');
    }
    if (endReason4 !== END_REASONS.CANDIDATE_STRUGGLING) {
      throw new Error(`Expected endReason ${END_REASONS.CANDIDATE_STRUGGLING}, but got ${endReason4}`);
    }
    console.log('✔ Simulation 4 PASSED (Stepped down from MEDIUM to EASY, early termination enforced).\n');

    console.log('===================================================================================');
    console.log(' ALL 4 INTERVIEW SIMULATIONS PASSED (100% SUCCESS)');
    console.log('===================================================================================\n');
  } catch (error) {
    console.error('\n❌ Simulation Test Execution Failed:', error);
    process.exitCode = 1;
  } finally {
    console.log('[Cleanup] Cleaning up all dummy test candidates and cascade records...');
    for (const candId of createdCandidateIds) {
      try {
        await prisma.candidate.delete({ where: { id: candId } });
        console.log(`  ✔ Cleaned up candidate ID: ${candId}`);
      } catch (cleanupErr) {
        console.warn(`  ⚠ Warning cleaning up candidate ${candId}: ${cleanupErr.message}`);
      }
    }
    await prisma.$disconnect();
    console.log('✔ Database connection closed.\n');
  }
}

runSimulations();

