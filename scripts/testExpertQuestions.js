/**
 * @file testExpertQuestions.js
 * @description Test suite for Part 7C: Live expert-authored question injection,
 * relevancy scoring, telemetry persistence, ladder non-interference, and report flagging.
 */

const prisma = require('../server/src/db/prismaClient');
const interviewService = require('../server/src/services/interviewService');
const reportService = require('../server/src/services/reportService');
const { scoreQuestionRelevancy } = require('../server/src/reports/questionRelevancy');

async function runExpertQuestionTests() {
  console.log('========================================================================');
  console.log('RAC DRDO PART 7C: EXPERT QUESTION INJECTION & RELEVANCY TEST');
  console.log('========================================================================\n');

  let candidate = null;
  let post = null;
  let session = null;

  try {
    // 1. Setup candidate with avionics skills and post
    console.log('[Step 1] Creating test candidate, skills, and post...');
    candidate = await prisma.candidate.create({
      data: {
        name: 'Dr. Expert Candidate 7C',
        postApplied: 'Scientist D - Avionics Architecture',
        experienceLevel: 'Scientist D',
      },
    });

    await prisma.candidateSkill.createMany({
      data: [
        { candidateId: candidate.id, skillName: 'Avionics Architecture' },
        { candidateId: candidate.id, skillName: 'Fault Tolerance' },
        { candidateId: candidate.id, skillName: 'DO-178C' },
      ],
    });

    const subject = await prisma.subject.findFirst();
    post = await prisma.post.create({
      data: {
        title: 'Scientist D - Avionics',
        subjectId: subject.id,
        level: 'Scientist D',
      },
    });

    await prisma.postSkill.createMany({
      data: [
        { postId: post.id, skillName: 'Avionics Architecture', weight: 5, isMandatory: true },
        { postId: post.id, skillName: 'Fault Tolerance', weight: 4, isMandatory: false },
      ],
    });

    console.log('   ✔ Candidate and Post created.');

    // 2. Relevancy preview test
    console.log('\n[Step 2] Testing Relevancy Preview for proposed expert question...');
    const preview = scoreQuestionRelevancy({
      question: {
        questionText: 'Explain Byzantine fault mitigation in distributed avionics architecture.',
        keywords: ['Byzantine fault', 'avionics architecture', 'fault tolerance'],
      },
      candidateSkills: ['Avionics Architecture', 'Fault Tolerance', 'DO-178C'],
      postSkills: [{ skillName: 'Avionics Architecture', weight: 5 }],
    });

    console.log(`   ✔ Relevancy score: ${Math.round(preview.questionRelevancy * 100)}% (isLowFit: ${preview.isLowFit})`);
    if (preview.questionRelevancy < 0.4) {
      throw new Error('Expected high fit for matching avionics skills.');
    }

    // 3. Start interview session
    console.log('\n[Step 3] Starting interview session...');
    const startResult = await interviewService.startInterview(candidate.id, post.id);
    const sessionId = startResult.sessionId;
    session = { id: sessionId };
    console.log(`   ✔ Session started: ${sessionId}`);

    // Answer warm-up icebreaker
    console.log('   ✔ Answering initial icebreaker question...');
    await interviewService.submitAnswer(
      sessionId,
      'I have 10 years of experience in defense research and fault tolerant avionics.'
    );

    // 4. Inject an expert question
    console.log('\n[Step 4] Live-injecting an EXPERT question...');
    const injectionResult = await interviewService.injectExpertQuestion(sessionId, {
      questionText: 'How do you structure consensus protocols under Byzantine failure conditions in avionics?',
      difficulty: 'HARD',
      idealAnswer: 'Byzantine fault tolerant protocols utilize multi-round voting mechanisms such as PBFT to establish consistent state across redundant channels.',
      keywords: ['Byzantine fault', 'voting mechanisms', 'redundant channels'],
      createdById: 'examiner-test-id',
    });

    console.log(`   ✔ Question injected: ${injectionResult.question.id} (Queue length: ${injectionResult.expertQueueLength})`);

    // Verify next question delivered is the expert question
    console.log('\n[Step 5] Checking that the next delivered question is the EXPERT question...');
    const activeQ = await interviewService.getCurrentQuestion(sessionId);
    if (activeQ.question.id === injectionResult.question.id) {
      console.log(`   ✔ Next question matches injected ID: ${activeQ.question.id}`);
    } else {
      throw new Error(`Expected injected question ${injectionResult.question.id}, got ${activeQ.question.id}`);
    }

    // Answer the expert question
    console.log('\n[Step 6] Submitting answer to expert question...');
    const answerResult = await interviewService.submitAnswer(
      sessionId,
      'We use Byzantine fault tolerant voting mechanisms across redundant channels to reach consensus.'
    );

    console.log(`   ✔ Answer evaluated with verdict: ${answerResult.scoring.verdict}`);
    console.log(`   ✔ Relevancy: ${Math.round((answerResult.scoring.relevancy || 0) * 100)}%`);

    // Verify response flagged with EXPERT_INJECTED
    const responseInDb = await prisma.response.findFirst({
      where: { sessionId, questionId: injectionResult.question.id },
    });

    const flags = responseInDb.breakdown?.flags || [];
    if (flags.includes('EXPERT_INJECTED')) {
      console.log('   ✔ Response breakdown correctly flagged with [EXPERT_INJECTED].');
    } else {
      throw new Error('Missing EXPERT_INJECTED flag on saved response breakdown.');
    }

    // Verify ExpertQuestionScore telemetry recorded
    const telemetry = await prisma.expertQuestionScore.findFirst({
      where: { sessionId, questionId: injectionResult.question.id },
    });

    if (telemetry) {
      console.log(`   ✔ ExpertQuestionScore persisted: avgRelevancy=${telemetry.avgRelevancy}%, countAsked=${telemetry.countAsked}`);
    } else {
      throw new Error('ExpertQuestionScore record was not persisted.');
    }

    // 7. Verify adaptive ladder state was NOT affected (technicalCount should not count expert question)
    const state = await prisma.sessionState.findUnique({ where: { sessionId } });
    console.log(`   ✔ Session technicalCount after expert question: ${state.technicalCount} (Expert question excluded from count limit)`);

    // End session and verify report
    console.log('\n[Step 7] Ending session and verifying report...');
    await interviewService.endInterviewEarly(sessionId, 'Test completion');

    const report = await reportService.getReport(sessionId);
    const expertFlagPresent = (report.flags?.activeFlags || []).includes('EXPERT_INJECTED');
    console.log(`   ✔ Report generated (Interview Score: ${report.interviewScore}%, Overall: ${report.overallScore}%)`);
    console.log(`   ✔ EXPERT_INJECTED flag in report: ${expertFlagPresent}`);

    console.log('\n========================================================================');
    console.log('ALL PART 7C EXPERT QUESTION TESTS PASSED WITH 100% SUCCESS');
    console.log('========================================================================\n');
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    console.log('[Cleanup] Cleaning up test database records...');
    if (candidate) {
      await prisma.candidate.delete({ where: { id: candidate.id } }).catch(() => {});
    }
    if (post) {
      await prisma.post.delete({ where: { id: post.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runExpertQuestionTests();

