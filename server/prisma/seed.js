/**
 * @file seed.js
 * @description Database seeding script for RAC DRDO Adaptive Interview System.
 * Reads subject, question bank, and job post skill data from JSON seed files and
 * populates the database idempotently (running multiple times produces identical state).
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Loads a JSON seed file from the seedData directory.
 * @param {string} filename - Filename of the seed data (e.g., 'asd.json', 'posts.json').
 * @returns {object|Array} Parsed JSON data.
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
        simplifiedText: q.simplifiedText || null,
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
        simplifiedText: q.simplifiedText || null,
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
        simplifiedText: q.simplifiedText || null,
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
        simplifiedText: q.simplifiedText || null,
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
 * Seeds job posts and their associated required skills idempotently.
 *
 * @param {Array<object>} postsData - Array of post objects with nested skills.
 * @returns {Promise<void>}
 */
async function seedPostsData(postsData) {
  console.log(`\n--- Seeding Job Posts & Required Skills (${postsData.length} posts) ---`);

  for (const post of postsData) {
    const upsertedPost = await prisma.post.upsert({
      where: { id: post.id },
      update: {
        title: post.title,
        subjectId: post.subjectId,
        level: post.level,
      },
      create: {
        id: post.id,
        title: post.title,
        subjectId: post.subjectId,
        level: post.level,
      },
    });
    console.log(`✔ Post ready: "${upsertedPost.title}" (${upsertedPost.id})`);

    for (const skill of post.skills) {
      await prisma.postSkill.upsert({
        where: {
          postId_skillName: {
            postId: upsertedPost.id,
            skillName: skill.skillName,
          },
        },
        update: {
          weight: skill.weight,
          isMandatory: skill.isMandatory,
        },
        create: {
          postId: upsertedPost.id,
          skillName: skill.skillName,
          weight: skill.weight,
          isMandatory: skill.isMandatory,
        },
      });
    }
    console.log(`  ✔ Seeded ${post.skills.length} skills for post: "${post.title}"`);
  }
}

/**
 * Main seeding execution function.
 */
async function main() {
  try {
    console.log('Initiating RAC DRDO Database Seeding...');

    // 1. Load and seed Advanced System Development (ASD) curriculum
    const asdData = loadSeedData('asd.json');
    await seedSubjectData(asdData);

    // 2. Load and seed Embedded Systems Design curriculum
    const esdData = loadSeedData('embeddedSystems.json');
    await seedSubjectData(esdData);

    // 3. Load and seed Posts & Required Skills
    const postsData = loadSeedData('posts.json');
    await seedPostsData(postsData);

    console.log('\nAll seeding completed successfully!');
  } catch (error) {
    console.error('Error during database seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
