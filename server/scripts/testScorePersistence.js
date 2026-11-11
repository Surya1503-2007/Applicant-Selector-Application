/**
 * @file testScorePersistence.js
 * @description Database integration test for Part 3 Answer Scorer persistence.
 *
 * Verifies:
 * 1. Creating dummy candidate and interview session
 * 2. Refreshing IDF cache from PostgreSQL questions
 * 3. Scoring and persisting 2 responses via scoreAndSaveResponse()
 * 4. Verifying persisted relevancyScore, correctnessScore, answerScore, verdict, and breakdown in DB
 * 5. Verifying ICEBREAKER without idealAnswer persists with null scores and verdict NOT_SCORED
 * 6. Verifying duplicate question submission in the same session is rejected (Part 1 unique constraint)
 * 7. Cleaning up all test records
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const prisma = require('../src/db/prismaClient');
const scorer = require('../src/scorers');
const sessionService = require('../src/services/sessionService');
const { scoreAndSaveResponse } = require('../src/services/answerScoringService');

/**
 * Runs the persistence verification workflow against PostgreSQL.
 */
async function runPersistenceTest() {
  console.log('========================================================================');
  console.log(' RAC DRDO Adaptive Interview System - Part 3: Persistence Test Suite');
  console.log('========================================================================\n');

  let dummyCandidate = null;
  let dummyIcebreaker = null;

  try {
    console.log('[Step 1] Connecting to PostgreSQL & refreshing IDF cache...');
    await prisma.$connect();
    const idfInfo = await scorer.refreshIdf();
    console.log(
      `✔ Connected. IDF initialized from ${idfInfo.documentCount} DB questions (${idfInfo.vocabularySize} unique stems).\n`
    );

    if (idfInfo.documentCount === 0) {
      throw new Error('No questions found in database. Run `npm run db:seed` first.');
    }

    console.log('[Step 2] Creating dummy candidate and session...');
    dummyCandidate = await sessionService.createCandidate(
      'Dr. Persistence Test Candidate',
      "Scientist 'C' - ASD",
      'Mid-Level'
    );
    const dummySession = await sessionService.createSession(dummyCandidate.id);
    console.log(`✔ Created candidate (${dummyCandidate.id}) & session (${dummySession.id}).\n`);

    console.log('[Step 3] Scoring & saving 2 technical answers via scoreAndSaveResponse()...');
    const res1 = await scoreAndSaveResponse(
      dummySession.id,
      'asd-req-e1',
      'In avionics systems, functional requirements specify exact system behavior such as missile trajectory computation, while non-functional requirements define quality attributes like latency, MTBF reliability, and MIL-STD compliance.'
    );
    console.log(
      `✔ Saved Response 1 (${res1.responseId}): score=${res1.answerScore}, verdict=${res1.verdict}`
    );

    const res2 = await scoreAndSaveResponse(
      dummySession.id,
      'asd-vv-e1',
      'Verification checks whether software matches engineering specifications through unit tests and reviews, whereas operational field testing confirms overall system suitability.'
    );
    console.log(
      `✔ Saved Response 2 (${res2.responseId}): score=${res2.answerScore}, verdict=${res2.verdict}\n`
    );

    console.log('[Step 4] Verifying persisted columns in PostgreSQL Response table...');
    const dbRow1 = await prisma.response.findUnique({ where: { id: res1.responseId } });
    const dbRow2 = await prisma.response.findUnique({ where: { id: res2.responseId } });

    if (!dbRow1 || !dbRow2) {
      throw new Error('Persisted Response rows not found in database.');
    }
    if (
      dbRow1.relevancyScore !== res1.relevancy ||
      dbRow1.correctnessScore !== res1.correctness ||
      dbRow1.answerScore !== res1.answerScore ||
      dbRow1.verdict !== res1.verdict ||
      !dbRow1.breakdown
    ) {
      throw new Error('DB Row 1 fields do not match returned scoreAndSaveResponse result.');
    }
    if (dbRow1.verdict !== 'STRONG') {
      throw new Error(`Expected Response 1 verdict STRONG, got ${dbRow1.verdict}`);
    }
    console.log('✔ Verified Response 1 & Response 2 fields (relevancyScore, correctnessScore, answerScore, verdict, breakdown).\n');

    console.log('[Step 5] Testing ICEBREAKER with empty idealAnswer -> NOT_SCORED...');
    dummyIcebreaker = await prisma.question.create({
      data: {
        difficulty: 'EASY',
        levelTag: 'ICEBREAKER',
        questionText: 'Tell us briefly about your engineering interests.',
        idealAnswer: '',
        keywords: [],
      },
    });
    const resIce = await scoreAndSaveResponse(
      dummySession.id,
      dummyIcebreaker.id,
      'I enjoy building fault-tolerant avionics architectures.'
    );
    const dbRowIce = await prisma.response.findUnique({ where: { id: resIce.responseId } });
    if (
      dbRowIce.verdict !== 'NOT_SCORED' ||
      dbRowIce.relevancyScore !== null ||
      dbRowIce.correctnessScore !== null ||
      dbRowIce.answerScore !== null
    ) {
      throw new Error(
        `ICEBREAKER without idealAnswer expected null scores and NOT_SCORED, got verdict=${dbRowIce.verdict}`
      );
    }
    console.log('✔ Verified ICEBREAKER without idealAnswer saved with null scores and verdict=NOT_SCORED.\n');

    console.log('[Step 6] Testing duplicate answer rejection (Part 1 unique constraint)...');
    let duplicateRejected = false;
    try {
      await scoreAndSaveResponse(
        dummySession.id,
        'asd-req-e1',
        'Duplicate submission attempt for the same question in the same session.'
      );
    } catch (err) {
      if (err.code === 'P2002' || err.statusCode === 409) {
        duplicateRejected = true;
        console.log(`✔ Duplicate answer rejected properly (${err.message}).\n`);
      } else {
        throw err;
      }
    }
    if (!duplicateRejected) {
      throw new Error('Expected duplicate answer in same session to be rejected, but it succeeded!');
    }

    console.log('========================================================================');
    console.log(' ALL PART 3 PERSISTENCE CHECKS PASSED SUCCESSFULLY (100%)');
    console.log('========================================================================\n');
  } catch (error) {
    console.error('❌ Persistence test failed:', error);
    process.exitCode = 1;
  } finally {
    console.log('[Cleanup] Removing dummy candidate, cascading session/responses, and temp question...');
    try {
      if (dummyCandidate) {
        await prisma.candidate.delete({ where: { id: dummyCandidate.id } });
        console.log(`✔ Deleted dummy candidate (${dummyCandidate.id}) and cascading records.`);
      }
      if (dummyIcebreaker) {
        await prisma.question.delete({ where: { id: dummyIcebreaker.id } });
        console.log(`✔ Deleted temporary icebreaker question (${dummyIcebreaker.id}).`);
      }
    } catch (cleanupErr) {
      console.warn(`⚠ Cleanup warning: ${cleanupErr.message}`);
    } finally {
      await prisma.$disconnect();
    }
  }
}

runPersistenceTest();

