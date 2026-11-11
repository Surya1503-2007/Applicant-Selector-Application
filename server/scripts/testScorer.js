/**
 * @file testScorer.js
 * @description Automated verification suite for Part 3: Answer Scorer.
 *
 * Tests all labelled samples in src/data/sampleAnswers.json plus NO_ANSWER, TOO_SHORT,
 * and long-answer padding edge cases. Prints a detailed score table, assertions,
 * overall pass rate, and any failed assertions.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const prisma = require('../src/db/prismaClient');
const scorer = require('../src/scorers');
const scorerConfig = require('../src/config/scorerConfig');
const asdSeed = require('../prisma/seedData/asd.json');
const sampleAnswers = require('../src/data/sampleAnswers.json');

/**
 * Loads questions from PostgreSQL if reachable, falling back to local ASD seed data
 * so deterministic scorer tests can run either connected or standalone.
 *
 * @async
 * @returns {Promise<{ questionMap: Record<string, object>, source: string }>}
 */
async function loadQuestionsAndInitIdf() {
  const seedQuestions = [...asdSeed.questions, ...asdSeed.icebreakers];

  if (process.env.DATABASE_URL) {
    try {
      await prisma.$connect();
      const dbQuestions = await prisma.question.findMany({
        include: { topic: true },
      });
      if (dbQuestions.length > 0) {
        await scorer.refreshIdf();
        const questionMap = Object.fromEntries(dbQuestions.map((q) => [q.id, q]));
        return { questionMap, source: `PostgreSQL (${dbQuestions.length} questions)` };
      }
    } catch (err) {
      console.warn(`⚠ DB unavailable (${err.message}); falling back to seedData/asd.json for IDF.`);
    }
  }

  await scorer.refreshIdf(seedQuestions);
  const questionMap = Object.fromEntries(seedQuestions.map((q) => [q.id, q]));
  return { questionMap, source: `seedData/asd.json (${seedQuestions.length} questions)` };
}

/**
 * Prints the formatted scoring table for all evaluated samples.
 *
 * @param {Array<object>} rows - Evaluated sample rows.
 */
function printResultsTable(rows) {
  console.log(
    '-------------------------------------------------------------------------------------------------------------'
  );
  console.log(
    'Question ID   | Label               | Relevancy | Correctness | AnswerScore | Verdict    | Flags'
  );
  console.log(
    '-------------------------------------------------------------------------------------------------------------'
  );
  for (const r of rows) {
    const qId = String(r.questionId).padEnd(13).slice(0, 13);
    const label = String(r.label).padEnd(19).slice(0, 19);
    const rel = r.result.relevancy.toFixed(3).padStart(9);
    const cor = r.result.correctness.toFixed(3).padStart(11);
    const ans = r.result.answerScore.toFixed(3).padStart(11);
    const verdict = String(r.result.verdict).padEnd(10).slice(0, 10);
    const flags = r.result.breakdown.flags.length ? r.result.breakdown.flags.join(', ') : '-';
    console.log(`${qId} | ${label} | ${rel} | ${cor} | ${ans} | ${verdict} | ${flags}`);
  }
  console.log(
    '-------------------------------------------------------------------------------------------------------------\n'
  );
}

/**
 * Records a test assertion result.
 *
 * @param {Array<object>} checks - Mutable checks list.
 * @param {string} id - Check identifier.
 * @param {boolean} passed - Whether the check passed.
 * @param {string} detail - Human-readable check description/error.
 */
function recordCheck(checks, id, passed, detail) {
  checks.push({ id, passed, detail });
}

/**
 * Executes the Part 3 scorer test suite.
 */
async function runScorerTests() {
  console.log('========================================================================');
  console.log(' RAC DRDO Adaptive Interview System - Part 3: Answer Scorer Test Suite');
  console.log('========================================================================\n');

  const checks = [];

  try {
    const { questionMap, source } = await loadQuestionsAndInitIdf();
    console.log(`Active Scorer : ${scorer.activeScorerName}`);
    console.log(`IDF Corpus    : ${source}\n`);

    const evaluatedRows = [];
    const byQuestion = new Map();

    for (const sample of sampleAnswers) {
      const question = questionMap[sample.questionId];
      if (!question) {
        throw new Error(`Sample "${sample.id}" references unknown questionId "${sample.questionId}".`);
      }

      const result = await scorer.scoreAnswer({
        question,
        answerText: sample.answerText,
      });

      const row = { ...sample, result };
      evaluatedRows.push(row);

      if (!byQuestion.has(sample.questionId)) {
        byQuestion.set(sample.questionId, {});
      }
      byQuestion.get(sample.questionId)[sample.label] = row;

      // Per-sample assertions
      if (sample.label === 'strong') {
        recordCheck(
          checks,
          sample.id,
          result.verdict === scorerConfig.VERDICTS.STRONG,
          `strong verdict expected STRONG, got ${result.verdict} (score=${result.answerScore})`
        );
      } else if (sample.label === 'irrelevant') {
        recordCheck(
          checks,
          sample.id,
          result.verdict === scorerConfig.VERDICTS.IRRELEVANT,
          `irrelevant verdict expected IRRELEVANT, got ${result.verdict} (score=${result.answerScore})`
        );
      } else if (sample.label === 'keyword-stuffed') {
        const hasFlag = result.breakdown.flags.includes(scorerConfig.FLAGS.KEYWORD_STUFFING);
        recordCheck(
          checks,
          `${sample.id} [flag]`,
          hasFlag,
          `keyword-stuffed expected KEYWORD_STUFFING flag, got [${result.breakdown.flags.join(', ')}]`
        );
      }
    }

    // Per-question ordering & anti-stuffing checks
    for (const [questionId, group] of byQuestion.entries()) {
      if (group.strong && group.partial && group.irrelevant) {
        const s = group.strong.result.answerScore;
        const p = group.partial.result.answerScore;
        const irr = group.irrelevant.result.answerScore;
        recordCheck(
          checks,
          `${questionId} [order]`,
          s > p && p > irr,
          `expected strong (${s}) > partial (${p}) > irrelevant (${irr})`
        );
      }

      if (group.strong && group['keyword-stuffed']) {
        const s = group.strong.result.answerScore;
        const stf = group['keyword-stuffed'].result.answerScore;
        recordCheck(
          checks,
          `${questionId} [stuffed < strong]`,
          stf < s,
          `expected keyword-stuffed (${stf}) < strong (${s})`
        );
      }
    }

    // Edge-case checks: NO_ANSWER (empty + phrases), TOO_SHORT, LONG_ANSWER_CAPPED
    const refQuestion = questionMap['asd-req-e1'];
    const noAnswerCases = [
      { id: 'edge-empty', label: 'no-answer(empty)', answerText: '' },
      { id: 'edge-whitespace', label: 'no-answer(spaces)', answerText: '    ' },
      { id: 'edge-idk', label: 'no-answer(idk)', answerText: "I don't know" },
      { id: 'edge-no-idea', label: 'no-answer(no idea)', answerText: 'No idea.' },
      { id: 'edge-pass', label: 'no-answer(pass)', answerText: 'pass' },
    ];

    for (const tc of noAnswerCases) {
      const result = await scorer.scoreAnswer({
        question: refQuestion,
        answerText: tc.answerText,
      });
      evaluatedRows.push({ questionId: refQuestion.id, label: tc.label, result });

      const ok =
        result.verdict === scorerConfig.VERDICTS.IRRELEVANT &&
        result.relevancy === 0 &&
        result.correctness === 0 &&
        result.answerScore === 0 &&
        result.breakdown.flags.includes(scorerConfig.FLAGS.NO_ANSWER);

      recordCheck(
        checks,
        tc.id,
        ok,
        `expected NO_ANSWER, 0/0/0, IRRELEVANT; got verdict=${result.verdict}, score=${result.answerScore}, flags=[${result.breakdown.flags.join(', ')}]`
      );
    }

    // TOO_SHORT check
    const shortRes = await scorer.scoreAnswer({
      question: refQuestion,
      answerText: 'Functional and non-functional requirements.',
    });
    evaluatedRows.push({ questionId: refQuestion.id, label: 'edge(too-short)', result: shortRes });
    recordCheck(
      checks,
      'edge-too-short',
      shortRes.breakdown.flags.includes(scorerConfig.FLAGS.TOO_SHORT) &&
        shortRes.answerScore <= scorerConfig.ANTI_GAMING.TOO_SHORT_MAX_SCORE,
      `expected TOO_SHORT flag and score <= ${scorerConfig.ANTI_GAMING.TOO_SHORT_MAX_SCORE}, got score=${shortRes.answerScore}, flags=[${shortRes.breakdown.flags.join(', ')}]`
    );

    // Padding / long-answer cap check
    const strongRef = byQuestion.get('asd-req-e1').strong;
    const filler = Array(280).fill('generic engineering discussion context detail').join(' ');
    const paddedRes = await scorer.scoreAnswer({
      question: refQuestion,
      answerText: `${strongRef.answerText} ${filler}`,
    });
    evaluatedRows.push({ questionId: refQuestion.id, label: 'edge(padded-long)', result: paddedRes });
    recordCheck(
      checks,
      'edge-long-padding',
      paddedRes.breakdown.flags.includes(scorerConfig.FLAGS.LONG_ANSWER_CAPPED) &&
        paddedRes.answerScore <= strongRef.result.answerScore,
      `expected LONG_ANSWER_CAPPED and padded (${paddedRes.answerScore}) <= strong (${strongRef.result.answerScore})`
    );

    // Print full table
    printResultsTable(evaluatedRows);

    // Summary & failures
    const passedChecks = checks.filter((c) => c.passed);
    const failedChecks = checks.filter((c) => !c.passed);
    const passRate = checks.length > 0 ? ((passedChecks.length / checks.length) * 100).toFixed(1) : '0.0';

    console.log(`Assertions Passed: ${passedChecks.length}/${checks.length} (${passRate}%)`);

    if (failedChecks.length > 0) {
      console.log('\nFailed Assertions:');
      for (const f of failedChecks) {
        console.log(`  ❌ [${f.id}] ${f.detail}`);
      }
      process.exitCode = 1;
    } else {
      console.log('✔ All Part 3 Answer Scorer assertions passed!\n');
    }
  } catch (err) {
    console.error('❌ Test suite error:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runScorerTests();

