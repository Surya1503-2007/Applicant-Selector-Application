/**
 * @file testMultiSubject.js
 * @description Comprehensive automated verification test suite for Part 7D:
 * Multi-subject support, data-only curriculum execution, bundle import dry-run,
 * and malformed/duplicate rejection handling.
 */

const prisma = require('../server/src/db/prismaClient');
const interviewService = require('../server/src/services/interviewService');
const reportService = require('../server/src/services/reportService');
const { importSubjectBundle } = require('../server/src/services/bundleImportService');

async function runMultiSubjectTests() {
  console.log('========================================================================');
  console.log('RAC DRDO PART 7D: MULTI-SUBJECT ADAPTIVE INTERVIEW & IMPORT TEST SUITE');
  console.log('========================================================================\n');

  let candidate = null;
  let post = null;
  let session = null;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Subject Bundle Import Engine - Dry-Run Validation
    // -------------------------------------------------------------------------
    console.log('[Test 1] Testing Subject Bundle Import - Dry-Run Mode...');
    const validTestBundle = {
      subject: {
        id: 'test-radar-001',
        name: 'Radar & Sensor Signal Processing',
      },
      topics: [
        { id: 'radar-top-cfar', name: 'CFAR Detection Algorithms' },
        { id: 'radar-top-aesa', name: 'AESA Beamforming' },
      ],
      questions: [
        {
          id: 'radar-cfar-e1',
          topicId: 'radar-top-cfar',
          difficulty: 'EASY',
          levelTag: 'TECHNICAL',
          questionText: 'Explain Cell-Averaging CFAR (CA-CFAR) in pulse-Doppler radar.',
          idealAnswer: 'CA-CFAR estimates background noise power by averaging reference cells on both sides of the cell under test to maintain a constant false alarm rate.',
          keywords: ['CA-CFAR', 'noise power', 'reference cells', 'false alarm rate'],
        },
        {
          id: 'radar-cfar-m1',
          topicId: 'radar-top-cfar',
          difficulty: 'MEDIUM',
          levelTag: 'TECHNICAL',
          questionText: 'How does Order-Statistic CFAR (OS-CFAR) handle multiple interfering targets?',
          idealAnswer: 'OS-CFAR sorts reference cells by magnitude and selects the kth ranked cell, preventing target masking in multiple target scenarios.',
          keywords: ['OS-CFAR', 'ranked cell', 'target masking', 'interfering targets'],
        },
        {
          id: 'radar-cfar-h1',
          topicId: 'radar-top-cfar',
          difficulty: 'HARD',
          levelTag: 'TECHNICAL',
          questionText: 'Design a space-time adaptive processing (STAP) clutter rejection filter for airborne AESA radar.',
          idealAnswer: 'STAP combines spatial samples from array antennas and temporal samples from radar pulses to form 2D adaptive weights filtering out ground clutter.',
          keywords: ['STAP', 'adaptive weights', 'clutter rejection', 'spatial-temporal'],
        },
        {
          id: 'radar-aesa-e1',
          topicId: 'radar-top-aesa',
          difficulty: 'EASY',
          levelTag: 'TECHNICAL',
          questionText: 'What is digital beamforming in active phased array antennas?',
          idealAnswer: 'Digital beamforming applies complex phase and amplitude weights to digitized antenna signals to dynamically steer radar beams.',
          keywords: ['digital beamforming', 'phased array', 'antenna signals', 'steer radar beams'],
        },
        {
          id: 'radar-aesa-m1',
          topicId: 'radar-top-aesa',
          difficulty: 'MEDIUM',
          levelTag: 'TECHNICAL',
          questionText: 'Explain grating lobe suppression in wideband AESA antenna lattices.',
          idealAnswer: 'Grating lobes are suppressed by maintaining inter-element spacing less than or equal to half the wavelength at the highest operational frequency.',
          keywords: ['grating lobes', 'antenna lattices', 'inter-element spacing', 'half wavelength'],
        },
        {
          id: 'radar-aesa-h1',
          topicId: 'radar-top-aesa',
          difficulty: 'HARD',
          levelTag: 'TECHNICAL',
          questionText: 'Derive the thermal noise figure and dynamic range limits of an integrated GaN T/R module array.',
          idealAnswer: 'GaN T/R modules balance high power amplifier efficiency with low noise amplifier noise figure through impedance matching and thermal dissipation modeling.',
          keywords: ['GaN', 'T/R module', 'noise figure', 'dynamic range'],
        },
      ],
    };

    const dryRunResult = await importSubjectBundle(validTestBundle, { dryRun: true });
    if (!dryRunResult.valid || !dryRunResult.dryRun) {
      throw new Error(`Dry-run validation failed: ${JSON.stringify(dryRunResult.errors)}`);
    }

    // Verify DB was NOT mutated during dry-run
    const dbSubjCheck = await prisma.subject.findUnique({
      where: { name: 'Radar & Sensor Signal Processing' },
    });
    if (dbSubjCheck) {
      throw new Error('Dry-run modified the database! Subject was erroneously persisted.');
    }
    console.log('   ✔ Dry-run passed: Bundle validated without modifying database.');
    console.log(`   ✔ Preview compiled: ${dryRunResult.topicsCount} topics, ${dryRunResult.questionsCount} questions.\n`);

    // -------------------------------------------------------------------------
    // TEST 2: Import Validation - Malformed & Duplicate Rejection
    // -------------------------------------------------------------------------
    console.log('[Test 2] Testing Subject Bundle Rejection on Duplicate & Malformed Rows...');

    // 2a. Duplicate topic ID within bundle
    const dupTopicBundle = {
      subject: { name: 'Faulty Subject' },
      topics: [
        { id: 'top-dup', name: 'Topic Alpha' },
        { id: 'top-dup', name: 'Topic Beta' },
      ],
      questions: [],
    };
    const dupTopicRes = await importSubjectBundle(dupTopicBundle, { dryRun: true });
    if (dupTopicRes.valid) {
      throw new Error('Engine failed to reject bundle with duplicate topic IDs.');
    }
    console.log('   ✔ Correctly rejected bundle with duplicate topic ID.');

    // 2b. Missing question idealAnswer or keywords on scorable question
    const malformedQBundle = {
      subject: { name: 'Malformed Question Subject' },
      topics: [{ id: 'top-1', name: 'Topic 1' }],
      questions: [
        {
          id: 'q-bad-1',
          topicId: 'top-1',
          difficulty: 'MEDIUM',
          levelTag: 'TECHNICAL',
          questionText: 'Valid question text here?',
          // Missing idealAnswer and keywords
        },
      ],
    };
    const malformedRes = await importSubjectBundle(malformedQBundle, { dryRun: true });
    if (malformedRes.valid) {
      throw new Error('Engine failed to reject question missing mandatory idealAnswer/keywords.');
    }
    console.log('   ✔ Correctly rejected scorable question missing idealAnswer/keywords.');

    // 2c. Question with self-referential parentQId
    const selfParentBundle = {
      subject: { name: 'Self Parent Subject' },
      topics: [{ id: 'top-1', name: 'Topic 1' }],
      questions: [
        {
          id: 'q-self-loop',
          topicId: 'top-1',
          difficulty: 'MEDIUM',
          levelTag: 'TECHNICAL',
          questionText: 'Self looping question?',
          idealAnswer: 'Ideal answer text here.',
          keywords: ['loop'],
          parentQId: 'q-self-loop', // circular
        },
      ],
    };
    const selfParentRes = await importSubjectBundle(selfParentBundle, { dryRun: true });
    if (selfParentRes.valid) {
      throw new Error('Engine failed to reject question with circular parentQId.');
    }
    console.log('   ✔ Correctly rejected circular parentQId dependency.\n');

    // -------------------------------------------------------------------------
    // TEST 3: Full End-to-End Interview Simulation on Second Subject:
    // "Embedded Systems Design" (Subject 2)
    // -------------------------------------------------------------------------
    console.log('[Test 3] Running Full Adaptive Interview on Subject 2: "Embedded Systems Design"...');

    // Fetch Embedded Systems subject and post from seed
    const esdSubject = await prisma.subject.findUnique({
      where: { name: 'Embedded Systems Design' },
    });
    if (!esdSubject) {
      throw new Error('Subject "Embedded Systems Design" not found in database. Run db:seed first.');
    }

    const esdPost = await prisma.post.findFirst({
      where: { subjectId: esdSubject.id },
      include: { postSkills: true },
    });
    if (!esdPost) {
      throw new Error('Post for "Embedded Systems Design" not found in database.');
    }
    console.log(`   ✔ Post identified: "${esdPost.title}" (${esdPost.id}) under Subject: "${esdSubject.name}"`);

    // Create Candidate specialized in Embedded Systems
    candidate = await prisma.candidate.create({
      data: {
        name: 'Dr. Ananya Sharma (ESD Candidate)',
        postApplied: esdPost.title,
        experienceLevel: "Scientist 'C'",
      },
    });

    await prisma.candidateSkill.createMany({
      data: [
        { candidateId: candidate.id, skillName: 'Real-Time Operating Systems (RTOS) & Concurrency' },
        { candidateId: candidate.id, skillName: 'MIL-STD-1553B & ARINC 429 Avionics Buses' },
        { candidateId: candidate.id, skillName: 'Hardware Fault Tolerance & Watchdog Systems' },
        { candidateId: candidate.id, skillName: 'Triple Modular Redundancy (TMR) FPGA Architecture' },
      ],
    });
    console.log(`   ✔ Candidate created: "${candidate.name}" with 4 domain skills.`);

    // 3a. Start interview
    const startResult = await interviewService.startInterview(candidate.id, esdPost.id);
    session = { id: startResult.sessionId };
    console.log(`   ✔ Session started: ${session.id}`);
    console.log(`   ✔ Initial Skill-Match: ${startResult.skillMatchSummary.matchPercent}% (${startResult.skillMatchSummary.band})`);

    // Answer the warm-up icebreaker question
    const q1Res = await interviewService.submitAnswer(
      session.id,
      'My name is Dr. Ananya Sharma. I have 7 years of research experience in safety-critical embedded flight computers and RTOS kernel architectures at DRDO labs.'
    );
    console.log(`   ✔ Answered initial icebreaker question.`);

    // 3b. Answer technical questions adaptively
    // Candidate answers strongly to demonstrate adaptive ladder ascension on ESD topics
    let stepCount = 1;
    let isComplete = false;
    let nextQ = q1Res.nextQuestion;

    const scriptedAnswers = [
      'Priority inversion occurs when a low-priority task holds a shared mutex and a medium-priority task preempts it, stalling the high-priority task. We resolve this using Priority Inheritance Protocol.',
      'RMS is static fixed-priority with ln(2) bound around 69%, while EDF is dynamic priority achieving up to 100% utilization in hard real-time systems.',
      'In MIL-STD-1553B, the Bus Controller orchestrates all traffic over dual-redundant channels, polling Remote Terminals which respond with 16-bit status words.',
      'A windowed watchdog timer enforces both lower and upper time boundaries for refreshing, guarding against both deadlock and tight runaway code loops.',
    ];

    while (nextQ && !isComplete && stepCount <= 4) {
      const answer = scriptedAnswers[stepCount - 1] || 'Standard technical domain answer covering safety-critical requirements.';
      console.log(`   [Step ${stepCount}] Answering: "${nextQ.questionText.slice(0, 60)}..." (Diff: ${nextQ.difficulty})`);

      const ansResult = await interviewService.submitAnswer(session.id, answer);
      console.log(`      Verdict: ${ansResult.scoring.verdict} | Action: ${ansResult.decision.action} | Reason: ${ansResult.decision.reason}`);

      if (ansResult.interviewComplete) {
        isComplete = true;
        break;
      }
      nextQ = ansResult.nextQuestion;
      stepCount++;
    }

    // 3c. Conclude interview and verify report generation
    if (!isComplete) {
      await interviewService.endInterviewEarly(session.id, 'BOARD_CONCLUDED');
    }

    console.log('\n[Step 4] Generating final assessment report for Subject 2 session...');
    const report = await reportService.generateReport(session.id);

    console.log(`   ✔ Report Generated (Version ${report.version}):`);
    console.log(`      - Interview Score   : ${report.interviewScore}%`);
    console.log(`      - Skill Match Score : ${report.skillMatchPercent}%`);
    console.log(`      - Overall Score     : ${report.overallScore}%`);
    console.log(`      - Recommendation    : ${report.systemRecommendation}`);
    console.log(`      - Relevancy Score   : ${report.questionRelevancyScore}% (${report.questionRelevancyBand})`);

    // Verify report topics belong exclusively to Embedded Systems Design
    const reportTopicEntries = Array.isArray(report.topicScores)
      ? report.topicScores
      : Object.values(report.topicScores || {});
    const reportTopicNames = reportTopicEntries.map((t) => t.topicName || t.name);
    console.log(`   ✔ Topics Assessed in Report: [${reportTopicNames.join(', ')}]`);

    if (reportTopicNames.length === 0) {
      throw new Error('Report generated without topic-wise scores.');
    }

    // Ensure ASD topics are NOT present in ESD report
    const asdTopicsPresent = reportTopicNames.filter((name) =>
      ['Requirements Analysis', 'System Architecture', 'Verification & Validation', 'Interface Management'].includes(name)
    );
    if (asdTopicsPresent.length > 0) {
      throw new Error(`Subject isolation failure! Found ASD topics [${asdTopicsPresent.join(', ')}] in ESD report.`);
    }

    // Ensure ESD topics ARE present
    const esdExpected = ['RTOS & Concurrency', 'Hardware Interfaces & Avionics Buses', 'Fault Tolerance & Hardware Reliability'];
    const esdMissing = esdExpected.filter((name) => !reportTopicNames.includes(name));
    if (esdMissing.length > 0) {
      throw new Error(`Missing expected ESD topics in report: [${esdMissing.join(', ')}]`);
    }
    console.log('   ✔ Verified Subject Isolation: Only Subject 2 topics present in report.');

    console.log('\n========================================================================');
    console.log('ALL PART 7D MULTI-SUBJECT & CURRICULUM IMPORT TESTS PASSED (100%)');
    console.log('========================================================================\n');
  } catch (err) {
    console.error('\n❌ Test Failure in Part 7D Suite:', err);
    process.exit(1);
  } finally {
    // Cleanup temporary test candidate & session
    if (candidate) {
      try {
        await prisma.candidate.delete({ where: { id: candidate.id } });
        console.log('✔ Test cleanup: Removed test candidate and cascading records.');
      } catch (cleanupErr) {
        // Ignored
      }
    }
    await prisma.$disconnect();
  }
}

runMultiSubjectTests();
