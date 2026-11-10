/**
 * @file testSkillMatch.js
 * @description Comprehensive test suite for Part 2: Skill-Match Suitability Engine.
 * Tests 4 critical candidate evaluation scenarios:
 * 1. Strong candidate (abbreviations like MBSE, V&V, RTOS) -> Expect STRONG band
 * 2. Moderate candidate (covers ~half the required competencies) -> Expect MODERATE band
 * 3. Weak / unrelated candidate (irrelevant skills) -> Expect WEAK band
 * 4. Candidate missing a mandatory skill but otherwise good -> Expect mandatoryGap = true
 *
 * Asserts all conditions, prints explainable breakdowns, and cleans up all dummy test data.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const prisma = require('../src/db/prismaClient');
const sessionService = require('../src/services/sessionService');
const skillMatchService = require('../src/services/skillMatchService');

/**
 * Formats breakdown entries into a readable console table.
 * @param {Array<object>} breakdown - Match breakdown list.
 */
function printBreakdownTable(breakdown) {
  console.log('  ---------------------------------------------------------------------------------------------------------');
  console.log('  Required Skill                        | Wt | Mand | Best Candidate Match         | Score | Match Type');
  console.log('  ---------------------------------------------------------------------------------------------------------');
  for (const item of breakdown) {
    const req = (item.requiredSkill || '').padEnd(37).slice(0, 37);
    const wt = String(item.weight).padStart(2);
    const mand = item.isMandatory ? ' YES' : '  NO';
    const cand = (item.bestCandidateSkill || '---').padEnd(28).slice(0, 28);
    const score = item.score.toFixed(2).padStart(5);
    const type = (item.matchType || 'none').padEnd(8);
    console.log(`  ${req} | ${wt} | ${mand} | ${cand} | ${score} | ${type}`);
  }
  console.log('  ---------------------------------------------------------------------------------------------------------');
}

/**
 * Main test suite execution.
 */
async function runSkillMatchTestSuite() {
  console.log('========================================================================');
  console.log(' RAC DRDO Adaptive Interview System - Part 2: Skill-Match Test Suite');
  console.log('========================================================================\n');

  const createdCandidateIds = [];
  const targetPostId = 'post-asd-sc-c';

  try {
    // -------------------------------------------------------------
    // Step 0: Ensure Target Post & Required Skills Exist
    // -------------------------------------------------------------
    console.log('[Step 0] Verifying database connectivity and target Post...');
    await prisma.$connect();

    const post = await prisma.post.findUnique({
      where: { id: targetPostId },
      include: { postSkills: true },
    });

    if (!post || !post.postSkills || post.postSkills.length === 0) {
      throw new Error(
        `Target post "${targetPostId}" not found. Please ensure "npm run db:seed" was executed.`
      );
    }

    console.log(`✔ Found Post: "${post.title}" (${post.id})`);
    console.log(`  Total Required Skills: ${post.postSkills.length}`);
    const mandatoryCount = post.postSkills.filter((s) => s.isMandatory).length;
    console.log(`  Mandatory Skills: ${mandatoryCount}, Desirable Skills: ${post.postSkills.length - mandatoryCount}\n`);

    // =============================================================
    // Scenario A: Strong Candidate (Domain Abbreviations & Acronyms)
    // =============================================================
    console.log('------------------------------------------------------------------------');
    console.log(' [Scenario A] Strong Candidate (Acronyms & Defense Domain Jargon)');
    console.log('------------------------------------------------------------------------');

    const candA = await sessionService.createCandidate(
      'Dr. Vikram Sharma',
      "Scientist 'C' - ASD",
      'Senior Systems Architect'
    );
    createdCandidateIds.push(candA.id);

    const strongSkills = [
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
    ];
    await skillMatchService.addCandidateSkills(candA.id, strongSkills);

    const resultA = await skillMatchService.computeSkillMatch(candA.id, targetPostId);

    console.log(`Candidate: "${candA.name}"`);
    console.log(`Match Percentage : ${resultA.matchPercent}%`);
    console.log(`Suitability Band : ${resultA.band}`);
    console.log(`Mandatory Gap    : ${resultA.mandatoryGap}`);
    console.log(`Covered Strengths: ${resultA.strengths.length}/${post.postSkills.length}`);
    printBreakdownTable(resultA.breakdown);

    if (resultA.band !== 'STRONG') {
      throw new Error(`Scenario A Failed: Expected band STRONG but received ${resultA.band}`);
    }
    if (resultA.mandatoryGap !== false) {
      throw new Error(`Scenario A Failed: Expected mandatoryGap false but received ${resultA.mandatoryGap}`);
    }
    if (resultA.matchPercent < 70) {
      throw new Error(`Scenario A Failed: Expected matchPercent >= 70 but received ${resultA.matchPercent}`);
    }
    console.log('✔ Scenario A PASSED (STRONG match verified, 0 mandatory gaps).\n');

    // =============================================================
    // Scenario B: Moderate Candidate (Covers about half of the skills)
    // =============================================================
    console.log('------------------------------------------------------------------------');
    console.log(' [Scenario B] Moderate Candidate (Partial Skill Coverage)');
    console.log('------------------------------------------------------------------------');

    const candB = await sessionService.createCandidate(
      'Ananya Patel',
      "Scientist 'C' - ASD",
      'Avionics Software Engineer'
    );
    createdCandidateIds.push(candB.id);

    const moderateSkills = [
      'Model-Based Systems Engineering',
      'Verification and Validation',
      'MIL-STD-1553B',
      'Requirements Engineering',
      'Python Scripting',
      'Git Version Control',
    ];
    await skillMatchService.addCandidateSkills(candB.id, moderateSkills);

    const resultB = await skillMatchService.computeSkillMatch(candB.id, targetPostId);

    console.log(`Candidate: "${candB.name}"`);
    console.log(`Match Percentage : ${resultB.matchPercent}%`);
    console.log(`Suitability Band : ${resultB.band}`);
    console.log(`Mandatory Gap    : ${resultB.mandatoryGap}`);
    console.log(`Missing Mandatory: [${resultB.missingMandatory.join(', ')}]`);
    console.log(`Covered Strengths: ${resultB.strengths.length}/${post.postSkills.length}`);
    printBreakdownTable(resultB.breakdown);

    if (resultB.band !== 'MODERATE') {
      throw new Error(`Scenario B Failed: Expected band MODERATE but received ${resultB.band}`);
    }
    if (resultB.matchPercent < 40 || resultB.matchPercent >= 70) {
      throw new Error(
        `Scenario B Failed: Expected matchPercent in [40, 69.99] but received ${resultB.matchPercent}`
      );
    }
    console.log('✔ Scenario B PASSED (MODERATE match verified).\n');

    // =============================================================
    // Scenario C: Weak / Unrelated Candidate
    // =============================================================
    console.log('------------------------------------------------------------------------');
    console.log(' [Scenario C] Weak / Unrelated Candidate');
    console.log('------------------------------------------------------------------------');

    const candC = await sessionService.createCandidate(
      'Rohan Mehta',
      "Scientist 'C' - ASD",
      'Web Developer'
    );
    createdCandidateIds.push(candC.id);

    const weakSkills = [
      'Digital Marketing',
      'Search Engine Optimization (SEO)',
      'React Frontend Development',
      'Content Writing',
      'Social Media Analytics',
    ];
    await skillMatchService.addCandidateSkills(candC.id, weakSkills);

    const resultC = await skillMatchService.computeSkillMatch(candC.id, targetPostId);

    console.log(`Candidate: "${candC.name}"`);
    console.log(`Match Percentage : ${resultC.matchPercent}%`);
    console.log(`Suitability Band : ${resultC.band}`);
    console.log(`Mandatory Gap    : ${resultC.mandatoryGap}`);
    console.log(`Missing Mandatory: [${resultC.missingMandatory.join(', ')}]`);
    console.log(`Covered Strengths: ${resultC.strengths.length}/${post.postSkills.length}`);
    printBreakdownTable(resultC.breakdown);

    if (resultC.band !== 'WEAK') {
      throw new Error(`Scenario C Failed: Expected band WEAK but received ${resultC.band}`);
    }
    if (resultC.matchPercent >= 40) {
      throw new Error(`Scenario C Failed: Expected matchPercent < 40 but received ${resultC.matchPercent}`);
    }
    if (resultC.mandatoryGap !== true) {
      throw new Error(`Scenario C Failed: Expected mandatoryGap true for weak candidate`);
    }
    console.log('✔ Scenario C PASSED (WEAK match verified, all mandatory skills flagged).\n');

    // =============================================================
    // Scenario D: Candidate Missing Mandatory Skill but Otherwise Good
    // =============================================================
    console.log('------------------------------------------------------------------------');
    console.log(' [Scenario D] Candidate Missing a Mandatory Skill (Flagged, Not Rejected)');
    console.log('------------------------------------------------------------------------');

    const candD = await sessionService.createCandidate(
      'Col. Rajesh Nair',
      "Scientist 'C' - ASD",
      'Embedded Systems Lead'
    );
    createdCandidateIds.push(candD.id);

    // Missing "MIL-STD-1553B Avionics Bus Architecture" (a mandatory skill!)
    const missingMandatorySkills = [
      'Model-Based Systems Engineering',
      'Requirements Traceability Matrix',
      'Verification and Validation',
      // Intentionally omitting MIL-STD-1553B
      'Interface Control Document',
      'Real-Time Operating Systems',
      'Hardware-in-the-Loop',
      'DO-178C',
      'Triple Modular Redundancy',
      'Environmental Stress Screening',
    ];
    await skillMatchService.addCandidateSkills(candD.id, missingMandatorySkills);

    const resultD = await skillMatchService.computeSkillMatch(candD.id, targetPostId);

    console.log(`Candidate: "${candD.name}"`);
    console.log(`Match Percentage : ${resultD.matchPercent}%`);
    console.log(`Suitability Band : ${resultD.band}`);
    console.log(`Mandatory Gap    : ${resultD.mandatoryGap}`);
    console.log(`Missing Mandatory: [${resultD.missingMandatory.join(', ')}]`);
    console.log(`Covered Strengths: ${resultD.strengths.length}/${post.postSkills.length}`);
    printBreakdownTable(resultD.breakdown);

    if (resultD.mandatoryGap !== true) {
      throw new Error(
        `Scenario D Failed: Expected mandatoryGap true because MIL-STD-1553B is missing.`
      );
    }
    if (!resultD.missingMandatory.includes('MIL-STD-1553B Avionics Bus Architecture')) {
      throw new Error(
        `Scenario D Failed: missingMandatory should contain "MIL-STD-1553B Avionics Bus Architecture".`
      );
    }
    if (resultD.matchPercent < 70) {
      throw new Error(
        `Scenario D Failed: Expected strong overall score (>70%) despite mandatory gap, got ${resultD.matchPercent}%`
      );
    }
    console.log(
      '✔ Scenario D PASSED (Candidate achieved high overall score but mandatoryGap=true flagged properly without hard rejection).\n'
    );

    console.log('========================================================================');
    console.log(' ALL 4 SKILL MATCH SCENARIOS PASSED WITH 100% SUCCESS');
    console.log('========================================================================\n');
  } catch (error) {
    console.error('\n❌ Test Suite Execution Failed:', error);
    process.exitCode = 1;
  } finally {
    // -------------------------------------------------------------
    // Step 5: Clean Up Dummy Data
    // -------------------------------------------------------------
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

runSkillMatchTestSuite();

