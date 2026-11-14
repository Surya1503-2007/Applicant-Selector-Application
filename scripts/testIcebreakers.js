/**
 * @file testIcebreakers.js
 * @description Test suite for Part 7C: Icebreaker scoring logic and non-interference with interview score.
 */

const { scoreIcebreaker } = require('../server/src/scorers/icebreakerScorer');
const { computeInterviewScore } = require('../server/src/reports/reportCalculator');

console.log('========================================================================');
console.log('RAC DRDO PART 7C: ICEBREAKER SCORER VERIFICATION SUITE');
console.log('========================================================================\n');

// Test 1: Empty answer scores 0
const emptyScore = scoreIcebreaker({ answerText: '', aspectKeywords: ['background', 'projects'] });
console.log('1. Checking empty response scoring:');
if (emptyScore.icebreakerScore === 0 && emptyScore.wordCount === 0) {
  console.log('   ✔ Empty response correctly yields icebreakerScore: 0');
} else {
  console.error('   ❌ Expected 0, got:', emptyScore);
  process.exit(1);
}

// Test 2: Aspect keyword coverage
const testAspects = ['education', 'avionics', 'experience'];
const detailedAnswer =
  'I completed my engineering education in aerospace systems and have spent five years working on defense avionics and real-time systems.';
const aspectResult = scoreIcebreaker({ answerText: detailedAnswer, aspectKeywords: testAspects });
console.log('2. Checking aspect keyword coverage:');
if (aspectResult.matchedAspects.length === 2 && aspectResult.aspectCoverage > 0.6) {
  console.log(`   ✔ Matched ${aspectResult.matchedAspects.length}/3 aspects (${Math.round(aspectResult.aspectCoverage * 100)}% coverage)`);
  console.log(`   ✔ Total icebreaker score: ${aspectResult.icebreakerScore}%`);
} else {
  console.error('   ❌ Aspect coverage check failed:', aspectResult);
  process.exit(1);
}

// Test 3: Weight defaults to 0 in interviewScore calculation
console.log('3. Checking that icebreaker questions have ZERO weight in interviewScore:');
const sampleResponses = [
  {
    questionId: 'ib-1',
    levelTag: 'ICEBREAKER',
    difficulty: 'EASY',
    answerScore: null,
    breakdown: { icebreakerScore: 85.0 },
  },
  {
    questionId: 'tech-1',
    levelTag: 'TECHNICAL',
    difficulty: 'EASY',
    answerScore: 0.8,
  },
  {
    questionId: 'tech-2',
    levelTag: 'TECHNICAL',
    difficulty: 'MEDIUM',
    answerScore: 0.9,
  },
];

const scoreWithoutIcebreaker = computeInterviewScore([sampleResponses[1], sampleResponses[2]]);
const scoreWithIcebreaker = computeInterviewScore(sampleResponses);

if (scoreWithoutIcebreaker === scoreWithIcebreaker && scoreWithIcebreaker > 0) {
  console.log(`   ✔ Interview score with icebreaker (${scoreWithIcebreaker}) strictly equals score without icebreaker (${scoreWithoutIcebreaker})`);
} else {
  console.error('   ❌ Icebreaker leaked into interview score:', { scoreWithoutIcebreaker, scoreWithIcebreaker });
  process.exit(1);
}

console.log('\n========================================================================');
console.log('ALL PART 7C ICEBREAKER TESTS PASSED (100% SUCCESS)');
console.log('========================================================================\n');

