/**
 * @file seed.js
 * @description Database seeding script for RAC DRDO Adaptive Interview System.
 * Reads subject and question bank data from JSON seed files and populates
 * the database idempotently (running multiple times produces identical state).
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

/**
 * Loads a JSON seed file from the seedData directory.
 * @param {string} filename - Filename of the seed data (e.g., 'asd.json').
 * @returns {object} Parsed JSON data.
 */
function loadSeedData(filename) {
  const filePath = path.join(__dirname, 'seedData', filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Seed data file not found at: ${filePath}`);
  }
  const rawData = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(rawData);
}

/**
 * Seeds a subject, its topics, and associated questions into the database.
 * Designed to be extensible so additional subjects can be added easily.
 *
 * @param {object} seedData - The subject data object loaded from JSON.
 * @returns {Promise<void>}
 */
async function seedSubjectData(seedData) {
  const { subject, topics, questions, icebreakers = [] } = seedData;

  console.log(`\n--- Seeding Subject: "${subject.name}" ---`);

  // 1. Upsert Subject
  const upsertedSubject = await prisma.subject.upsert({
    where: { name: subject.name },
    update: { id: subject.id },
    create: {
      id: subject.id,
      name: subject.name,
    },
  });
  console.log(`✔ Subject ready: ${upsertedSubject.name} (${upsertedSubject.id})`);

  // 2. Upsert Topics
  for (const topic of topics) {
    await prisma.topic.upsert({
      where: {
        subjectId_name: {
          subjectId: upsertedSubject.id,
          name: topic.name,
        },
      },
      update: { id: topic.id },
      create: {
        id: topic.id,
        name: topic.name,
        subjectId: upsertedSubject.id,
      },
    });
    console.log(`  ✔ Topic ready: ${topic.name} (${topic.id})`);
  }

  // 3. Upsert Questions
  // Sort questions so that parent questions (parentQId === null) are created before children
  const allQuestions = [...icebreakers, ...questions];
  const independentQuestions = allQuestions.filter((q) => !q.parentQId);
  const dependentQuestions = allQuestions.filter((q) => !!q.parentQId);

  console.log(`\nSeeding independent questions (${independentQuestions.length})...`);
  for (const q of independentQuestions) {
    await prisma.question.upsert({
      where: { id: q.id },
      update: {
        topicId: q.topicId || null,
        difficulty: q.difficulty,
        questionText: q.questionText,
        idealAnswer: q.idealAnswer,
        keywords: q.keywords,
        parentQId: null,
        levelTag: q.levelTag,
      },
      create: {
        id: q.id,
        topicId: q.topicId || null,
        difficulty: q.difficulty,
        questionText: q.questionText,
        idealAnswer: q.idealAnswer,
        keywords: q.keywords,
        parentQId: null,
        levelTag: q.levelTag,
      },
    });
  }

  console.log(`Seeding dependent follow-up questions (${dependentQuestions.length})...`);
  for (const q of dependentQuestions) {
    await prisma.question.upsert({
      where: { id: q.id },
      update: {
        topicId: q.topicId || null,
        difficulty: q.difficulty,
        questionText: q.questionText,
        idealAnswer: q.idealAnswer,
        keywords: q.keywords,
        parentQId: q.parentQId,
        levelTag: q.levelTag,
      },
      create: {
        id: q.id,
        topicId: q.topicId || null,
        difficulty: q.difficulty,
        questionText: q.questionText,
        idealAnswer: q.idealAnswer,
        keywords: q.keywords,
        parentQId: q.parentQId,
        levelTag: q.levelTag,
      },
    });
  }

  console.log(`✔ Finished seeding ${allQuestions.length} questions for "${subject.name}".`);
}

/**
 * Main seeding execution function.
 */
async function main() {
  try {
    console.log('Initiating RAC DRDO Database Seeding...');

    // Load and seed Advanced System Development (ASD)
    const asdData = loadSeedData('asd.json');
    await seedSubjectData(asdData);

    console.log('\nSeeding completed successfully!');
  } catch (error) {
    console.error('Error during database seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

