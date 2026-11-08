/**
 * @file testDb.js
 * @description End-to-end database verification script for RAC DRDO Adaptive Interview System (Part 1).
 *
 * Verifies:
 * 1. Database connectivity and schema integrity
 * 2. Candidate and Session lifecycle management
 * 3. Retrieval of Easy question and linked Medium follow-up question
 * 4. Recording responses and enforcing duplicate question prevention per session
 * 5. Comprehensive cleanup of test entities
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const prisma = require('../src/db/prismaClient');
const questionService = require('../src/services/questionService');
const sessionService = require('../src/services/sessionService');

/**
 * Runs the database and service layer verification suite.
 */
async function runTest() {
  console.log('===============================================================');
  console.log(' RAC DRDO Adaptive Interview System - Database Test Suite');
  console.log('===============================================================\n');

  let dummyCandidate = null;
  let dummySession = null;

  try {
    // -------------------------------------------------------------
    // Step 1: Verify Database Connection & Seed Data Presence
    // -------------------------------------------------------------
    console.log('[Step 1] Connecting to PostgreSQL Database...');
    await prisma.$connect();
    console.log('✔ Successfully connected to PostgreSQL.\n');

    const subjectCount = await prisma.subject.count();
    const topicCount = await prisma.topic.count();
    const questionCount = await prisma.question.count();

    console.log(`[Seed Verification] Current DB Counts:`);
    console.log(`  - Subjects  : ${subjectCount}`);
    console.log(`  - Topics    : ${topicCount}`);
    console.log(`  - Questions : ${questionCount}`);

    if (questionCount === 0) {
      throw new Error('Database question bank is empty. Please run `npm run db:seed` first.');
    }
    console.log('✔ Seed data verified.\n');

    // -------------------------------------------------------------
    // Step 2: Create Dummy Candidate and Session
    // -------------------------------------------------------------
    console.log('[Step 2] Creating dummy candidate and interview session...');
    dummyCandidate = await sessionService.createCandidate(
      'Dr. Test Candidate',
      "Scientist 'B' - Advanced System Development",
      'Entry-Level Scientist'
    );
    console.log(`✔ Dummy Candidate created: "${dummyCandidate.name}" (ID: ${dummyCandidate.id})`);

    dummySession = await sessionService.createSession(dummyCandidate.id);
    console.log(`✔ Dummy Session created: (ID: ${dummySession.id}, Start: ${dummySession.startTime.toISOString()})\n`);

    // -------------------------------------------------------------
    // Step 3: Fetch an Easy Question for Requirements Analysis
    // -------------------------------------------------------------
    console.log('[Step 3] Fetching an Easy question for topic "asd-top-req"...');
    const easyQuestion = await questionService.getNextQuestion('asd-top-req', 'EASY', []);
    if (!easyQuestion) {
      throw new Error('No Easy question found for topic "asd-top-req". Check seed data.');
    }

    console.log('✔ Found Easy Question:');
    console.log(`  - ID: ${easyQuestion.id}`);
    console.log(`  - Difficulty: ${easyQuestion.difficulty}`);
    console.log(`  - LevelTag: ${easyQuestion.levelTag}`);
    console.log(`  - Question Text: "${easyQuestion.questionText}"`);
    console.log(`  - Ideal Answer: "${easyQuestion.idealAnswer}"`);
    console.log(`  - Keywords: [${easyQuestion.keywords.join(', ')}]`);
    console.log(`  - ParentQId: ${easyQuestion.parentQId || 'None (Root question)'}\n`);

    // Record response to the Easy Question
    console.log('Recording candidate response to Easy question...');
    const response1 = await sessionService.addResponse(
      dummySession.id,
      easyQuestion.id,
      'Functional requirements define the core operational behavior like missile trajectory calculation, while non-functional requirements define constraints like latency and MTBF.',
      0.92,
      0.95
    );
    console.log(`✔ Response recorded (ID: ${response1.id}, Relevancy: ${response1.relevancyScore}, Correctness: ${response1.correctnessScore})\n`);

    // -------------------------------------------------------------
    // Step 4: Fetch Linked Medium Follow-up Question
    // -------------------------------------------------------------
    console.log(`[Step 4] Fetching linked Medium follow-up question for parent: "${easyQuestion.id}"...`);
    const followUps = await questionService.getFollowupQuestions(easyQuestion.id);

    if (followUps.length === 0) {
      throw new Error(`Expected at least one follow-up question linked to parent ${easyQuestion.id}`);
    }

    const mediumFollowUp = followUps[0];
    console.log('✔ Found Linked Follow-Up Question:');
    console.log(`  - ID: ${mediumFollowUp.id}`);
    console.log(`  - Difficulty: ${mediumFollowUp.difficulty}`);
    console.log(`  - LevelTag: ${mediumFollowUp.levelTag}`);
    console.log(`  - Question Text: "${mediumFollowUp.questionText}"`);
    console.log(`  - Ideal Answer: "${mediumFollowUp.idealAnswer}"`);
    console.log(`  - Keywords: [${mediumFollowUp.keywords.join(', ')}]`);
    console.log(`  - ParentQId: ${mediumFollowUp.parentQId} (Matches Easy Question: ${mediumFollowUp.parentQId === easyQuestion.id})\n`);

    // Record response to the Medium Follow-Up Question
    console.log('Recording candidate response to Medium follow-up question...');
    const response2 = await sessionService.addResponse(
      dummySession.id,
      mediumFollowUp.id,
      'A bidirectional RTM maps operational requirements down through design specifications, software modules, and verification test cases, ensuring DO-178C compliance.',
      0.89,
      0.91
    );
    console.log(`✔ Response recorded (ID: ${response2.id}, Relevancy: ${response2.relevancyScore}, Correctness: ${response2.correctnessScore})\n`);

    // -------------------------------------------------------------
    // Step 5: Verify Duplicate Question Prevention in Session
    // -------------------------------------------------------------
    console.log('[Step 5] Verifying that no question is asked or recorded twice in the same session...');

    // 5A: Verify asked question IDs list
    const askedIds = await sessionService.getAskedQuestionIds(dummySession.id);
    console.log(`  - Asked Question IDs in Session: [${askedIds.join(', ')}]`);

    if (!askedIds.includes(easyQuestion.id) || !askedIds.includes(mediumFollowUp.id)) {
      throw new Error('Asked question IDs list is missing previously answered questions.');
    }

    // 5B: Service-level exclusion check: getNextQuestion must exclude asked questions
    const nextQuestion = await questionService.getNextQuestion('asd-top-req', 'EASY', askedIds);
    if (nextQuestion) {
      console.log(`  - Next candidate Easy question returned: ${nextQuestion.id}`);
      if (askedIds.includes(nextQuestion.id)) {
        throw new Error(`CRITICAL ERROR: getNextQuestion returned an already-asked question (${nextQuestion.id})!`);
      }
      console.log(`✔ Confirmed: getNextQuestion strictly excluded already-asked question (${easyQuestion.id}).`);
    } else {
      console.log('✔ Confirmed: All Easy questions exhausted; none of the asked questions were re-served.');
    }

    // 5C: Database-level constraint check: Attempt to insert duplicate response for easyQuestion
    console.log('  - Testing database unique constraint @@unique([sessionId, questionId])...');
    let duplicateRejected = false;
    try {
      await sessionService.addResponse(
        dummySession.id,
        easyQuestion.id,
        'Attempting duplicate answer submission.',
        0.5,
        0.5
      );
    } catch (err) {
      // Prisma unique constraint violation code is P2002
      if (err.code === 'P2002' || err.message.includes('Unique constraint failed')) {
        duplicateRejected = true;
        console.log(`✔ Confirmed: Database constraint rejected duplicate question in session (Prisma Error P2002).`);
      } else {
        throw err;
      }
    }

    if (!duplicateRejected) {
      throw new Error('Database failed to enforce uniqueness on [sessionId, questionId]!');
    }

    // End session
    await sessionService.endSession(dummySession.id);
    console.log(`✔ Session successfully ended.\n`);

    console.log('===============================================================');
    console.log(' ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (100%)');
    console.log('===============================================================\n');
  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    process.exitCode = 1;
  } finally {
    // -------------------------------------------------------------
    // Step 6: Cleanup Dummy Data
    // -------------------------------------------------------------
    console.log('[Step 6] Cleaning up dummy test data...');
    try {
      if (dummyCandidate) {
        // Deleting candidate cascades to sessions and responses
        await prisma.candidate.delete({
          where: { id: dummyCandidate.id },
        });
        console.log(`✔ Cleaned up dummy candidate (${dummyCandidate.id}) and all cascading sessions/responses.`);
      }
    } catch (cleanupErr) {
      console.error('Warning during cleanup:', cleanupErr.message);
    } finally {
      await prisma.$disconnect();
    }
  }
}

runTest();

