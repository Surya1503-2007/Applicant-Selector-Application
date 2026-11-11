/**
 * @file calibrateScorer.js
 * @description Grid-search calibration utility for Part 3 Answer Scorer.
 * Evaluates combinations of verdict thresholds and blend weights over src/data/sampleAnswers.json
 * and prints the highest-accuracy suggestions WITHOUT modifying src/config/scorerConfig.js.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const prisma = require('../src/db/prismaClient');
const logicScorer = require('../src/scorers/logicScorer');
const scorerConfig = require('../src/config/scorerConfig');
const asdSeed = require('../prisma/seedData/asd.json');
const sampleAnswers = require('../src/data/sampleAnswers.json');

/**
 * Loads question records and initializes IDF cache (DB first, seed JSON fallback).
 *
 * @async
 * @returns {Promise<Record<string, object>>} Map of questionId -> Question.
 */
async function initCorpus() {
  const seedQuestions = [...asdSeed.questions, ...asdSeed.icebreakers];
  if (process.env.DATABASE_URL) {
    try {
      await prisma.$connect();
      const dbQuestions = await prisma.question.findMany({ include: { topic: true } });
      if (dbQuestions.length > 0) {
        await logicScorer.refreshIdf();
        return Object.fromEntries(dbQuestions.map((q) => [q.id, q]));
      }
    } catch {
      // Fallback cleanly to local seed data
    }
  }
  await logicScorer.refreshIdf(seedQuestions);
  return Object.fromEntries(seedQuestions.map((q) => [q.id, q]));
}

/**
 * Evaluates whether a sample answer's predicted verdict matches its label expectation.
 *
 * @param {string} label - Sample label ('strong'|'partial'|'irrelevant'|'keyword-stuffed'|'paraphrased-correct').
 * @param {string} verdict - Predicted verdict ('STRONG'|'PARTIAL'|'IRRELEVANT').
 * @returns {boolean} True if predicted verdict satisfies the label expectation.
 */
function matchesLabelExpectation(label, verdict) {
  switch (label) {
    case 'strong':
      return verdict === 'STRONG';
    case 'partial':
      return verdict === 'PARTIAL';
    case 'irrelevant':
      return verdict === 'IRRELEVANT';
    case 'keyword-stuffed':
      return verdict !== 'STRONG';
    case 'paraphrased-correct':
      return verdict === 'PARTIAL' || verdict === 'STRONG';
    default:
      return false;
  }
}

/**
 * Evaluates a candidate scorerConfig override over all samples in sampleAnswers.json.
 *
 * @param {Record<string, object>} questionMap - Map of questionId -> Question.
 * @param {object} configOverride - Partial scorerConfig override.
 * @returns {{
 *   overallAccuracy: number,
 *   coreAccuracy: number,
 *   orderingPassRate: number,
 *   matchedCount: number,
 *   totalCount: number,
 *   coreMatched: number,
 *   coreTotal: number,
 *   orderingPassed: number,
 *   orderingTotal: number,
 *   separationMargin: number
 * }} Evaluation metrics.
 */
function evaluateConfig(questionMap, configOverride) {
  let matchedCount = 0;
  let coreMatched = 0;
  let coreTotal = 0;
  const byQuestion = new Map();

  for (const sample of sampleAnswers) {
    const res = logicScorer.scoreAnswer(
      { question: questionMap[sample.questionId], answerText: sample.answerText },
      configOverride
    );

    if (matchesLabelExpectation(sample.label, res.verdict)) {
      matchedCount += 1;
    }

    if (['strong', 'partial', 'irrelevant'].includes(sample.label)) {
      coreTotal += 1;
      if (matchesLabelExpectation(sample.label, res.verdict)) {
        coreMatched += 1;
      }
    }

    if (!byQuestion.has(sample.questionId)) {
      byQuestion.set(sample.questionId, {});
    }
    byQuestion.get(sample.questionId)[sample.label] = res.answerScore;
  }

  let orderingPassed = 0;
  let totalMargin = 0;
  for (const scores of byQuestion.values()) {
    const ok =
      scores.strong > scores.partial &&
      scores.partial > scores.irrelevant &&
      scores['keyword-stuffed'] < scores.strong;
    if (ok) {
      orderingPassed += 1;
      totalMargin += Math.min(scores.strong - scores.partial, scores.partial - scores.irrelevant);
    }
  }

  const orderingTotal = byQuestion.size;
  return {
    overallAccuracy: matchedCount / sampleAnswers.length,
    coreAccuracy: coreTotal > 0 ? coreMatched / coreTotal : 0,
    orderingPassRate: orderingTotal > 0 ? orderingPassed / orderingTotal : 0,
    matchedCount,
    totalCount: sampleAnswers.length,
    coreMatched,
    coreTotal,
    orderingPassed,
    orderingTotal,
    separationMargin: orderingPassed > 0 ? totalMargin / orderingPassed : 0,
  };
}

/**
 * Runs grid search over verdict thresholds and blend weights.
 */
async function runCalibration() {
  console.log('========================================================================');
  console.log(' RAC DRDO Adaptive Interview System - Part 3: Scorer Grid Calibration');
  console.log('========================================================================\n');

  try {
    const questionMap = await initCorpus();

    // 1. Evaluate current config baseline
    const baseline = evaluateConfig(questionMap, {});
    console.log('[Current Config Baseline (src/config/scorerConfig.js)]');
    console.log(
      `  Overall Accuracy : ${(baseline.overallAccuracy * 100).toFixed(1)}% (${baseline.matchedCount}/${baseline.totalCount})`
    );
    console.log(
      `  Core Accuracy    : ${(baseline.coreAccuracy * 100).toFixed(1)}% (${baseline.coreMatched}/${baseline.coreTotal} strong/partial/irrelevant)`
    );
    console.log(
      `  Ordering Checks  : ${baseline.orderingPassed}/${baseline.orderingTotal} questions passed`
    );
    console.log(
      `  Thresholds       : IRRELEVANT < ${scorerConfig.VERDICT_THRESHOLDS.IRRELEVANT_MAX}, STRONG > ${scorerConfig.VERDICT_THRESHOLDS.STRONG_MIN}`
    );
    console.log(
      `  Answer Weights   : relevancy=${scorerConfig.SCORING_WEIGHTS.ANSWER_SCORE.relevancy}, correctness=${scorerConfig.SCORING_WEIGHTS.ANSWER_SCORE.correctness}\n`
    );

    // 2. Define calibration grid
    const irrelevantThresholds = [0.25, 0.30, 0.35, 0.40];
    const strongThresholds = [0.65, 0.68, 0.70, 0.75];
    const answerRelWeights = [0.3, 0.4, 0.5];
    const corKeywordWeights = [0.45, 0.55, 0.65, 0.75];
    const relTopicWeights = [0.4, 0.5, 0.6];

    const candidates = [];

    for (const irrMax of irrelevantThresholds) {
      for (const strMin of strongThresholds) {
        if (strMin <= irrMax + 0.15) continue;

        for (const wRel of answerRelWeights) {
          const wCor = Math.round((1 - wRel) * 100) / 100;

          for (const wKw of corKeywordWeights) {
            const wIdealCor = Math.round((1 - wKw) * 100) / 100;

            for (const wTop of relTopicWeights) {
              const rem = Math.round((1 - wTop) * 100) / 100;
              const wQ = Math.round(rem * 0.4 * 100) / 100;
              const wIdealRel = Math.round((rem - wQ) * 100) / 100;

              const override = {
                VERDICT_THRESHOLDS: {
                  IRRELEVANT_MAX: irrMax,
                  STRONG_MIN: strMin,
                },
                SCORING_WEIGHTS: {
                  ANSWER_SCORE: { relevancy: wRel, correctness: wCor },
                  CORRECTNESS: { keywordCoverage: wKw, idealAnswerSimilarity: wIdealCor },
                  RELEVANCY: {
                    topicOverlap: wTop,
                    questionSimilarity: wQ,
                    idealAnswerSimilarity: wIdealRel,
                  },
                },
              };

              const metrics = evaluateConfig(questionMap, override);
              candidates.push({ override, metrics });
            }
          }
        }
      }
    }

    // Sort by overallAccuracy desc, orderingPassRate desc, coreAccuracy desc, separationMargin desc
    candidates.sort((a, b) => {
      if (b.metrics.overallAccuracy !== a.metrics.overallAccuracy) {
        return b.metrics.overallAccuracy - a.metrics.overallAccuracy;
      }
      if (b.metrics.orderingPassRate !== a.metrics.orderingPassRate) {
        return b.metrics.orderingPassRate - a.metrics.orderingPassRate;
      }
      if (b.metrics.coreAccuracy !== a.metrics.coreAccuracy) {
        return b.metrics.coreAccuracy - a.metrics.coreAccuracy;
      }
      return b.metrics.separationMargin - a.metrics.separationMargin;
    });

    console.log(`Grid search evaluated ${candidates.length} parameter combinations.\n`);
    console.log('[Top 5 Suggested Calibration Settings (Read-Only Suggestion)]');
    console.log(
      '-------------------------------------------------------------------------------------------------------------'
    );
    const top5 = candidates.slice(0, 5);
    top5.forEach((entry, idx) => {
      const { override, metrics } = entry;
      const vt = override.VERDICT_THRESHOLDS;
      const aw = override.SCORING_WEIGHTS.ANSWER_SCORE;
      const cw = override.SCORING_WEIGHTS.CORRECTNESS;
      const rw = override.SCORING_WEIGHTS.RELEVANCY;
      console.log(
        `#${idx + 1} | Acc: ${(metrics.overallAccuracy * 100).toFixed(1)}% (${metrics.matchedCount}/${metrics.totalCount}) | Core: ${metrics.coreMatched}/${metrics.coreTotal} | Ord: ${metrics.orderingPassed}/${metrics.orderingTotal}`
      );
      console.log(
        `     Thresholds  : IRRELEVANT < ${vt.IRRELEVANT_MAX}, STRONG > ${vt.STRONG_MIN}`
      );
      console.log(
        `     ANSWER_SCORE: relevancy=${aw.relevancy}, correctness=${aw.correctness}`
      );
      console.log(
        `     CORRECTNESS : keywordCoverage=${cw.keywordCoverage}, idealAnswerSimilarity=${cw.idealAnswerSimilarity}`
      );
      console.log(
        `     RELEVANCY   : topicOverlap=${rw.topicOverlap}, questionSimilarity=${rw.questionSimilarity}, idealAnswerSimilarity=${rw.idealAnswerSimilarity}`
      );
    });
    console.log(
      '-------------------------------------------------------------------------------------------------------------'
    );
    console.log('ℹ Note: Calibration only suggests values; src/config/scorerConfig.js was NOT modified.\n');
  } catch (err) {
    console.error('❌ Calibration failed:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runCalibration();

