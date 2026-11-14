/**
 * @file bundleImportService.js
 * @description Ingestion and validation engine for Subject Bundle JSON files (Part 7D).
 * Provides dry-run validation, duplicate detection, malformed row rejections,
 * dependency checking (parentQId), and idempotent transactional ingestion.
 */

const prisma = require('../db/prismaClient');
const SUBJECT_CONFIG = require('../config/subjectConfig');

/**
 * Validates and imports (or previews) a subject bundle containing a subject, its topics,
 * questions, and optional icebreakers.
 *
 * @param {object} bundle - The parsed JSON bundle object.
 * @param {object} [options={}] - Options.
 * @param {boolean} [options.dryRun=false] - If true, validates and previews without modifying DB.
 * @returns {Promise<{
 *   valid: boolean,
 *   dryRun: boolean,
 *   subject: { id?: string, name: string },
 *   topicsCount: number,
 *   questionsCount: number,
 *   preview: object,
 *   errors: string[],
 *   warnings: string[]
 * }>}
 */
async function importSubjectBundle(bundle, options = {}) {
  const { dryRun = false } = options;
  const errors = [];
  const warnings = [];

  if (!bundle || typeof bundle !== 'object') {
    return {
      valid: false,
      dryRun,
      errors: ['Malformed payload: Expected a valid JSON object as subject bundle.'],
      warnings: [],
      preview: null,
    };
  }

  // 1. Validate Subject
  const { subject, topics = [], questions = [], icebreakers = [] } = bundle;

  if (!subject || typeof subject !== 'object') {
    errors.push('Bundle is missing mandatory "subject" object.');
  } else if (!subject.name || typeof subject.name !== 'string' || !subject.name.trim()) {
    errors.push('Subject definition must include a non-empty "name" string.');
  }

  // 2. Validate Topics
  if (!Array.isArray(topics) || topics.length === 0) {
    errors.push('Bundle must declare a non-empty "topics" array.');
  }

  const topicIds = new Set();
  const topicNames = new Set();
  const validatedTopics = [];

  if (Array.isArray(topics)) {
    topics.forEach((t, index) => {
      if (!t || typeof t !== 'object') {
        errors.push(`Topic at index ${index} is not an object.`);
        return;
      }
      const tName = t.name && typeof t.name === 'string' ? t.name.trim() : null;
      if (!tName) {
        errors.push(`Topic at index ${index} missing required "name".`);
        return;
      }
      if (topicNames.has(tName.toLowerCase())) {
        errors.push(`Duplicate topic name "${tName}" within bundle.`);
      }
      topicNames.add(tName.toLowerCase());

      const tId = t.id && typeof t.id === 'string' ? t.id.trim() : null;
      if (tId) {
        if (topicIds.has(tId)) {
          errors.push(`Duplicate topic id "${tId}" within bundle.`);
        }
        topicIds.add(tId);
      }

      validatedTopics.push({
        id: tId,
        name: tName,
      });
    });
  }

  // 3. Validate Questions
  const allQuestions = [...(Array.isArray(icebreakers) ? icebreakers : []), ...(Array.isArray(questions) ? questions : [])];
  const questionIds = new Set();
  const validatedQuestions = [];

  const allowedDifficulties = new Set(SUBJECT_CONFIG.DIFFICULTIES || ['EASY', 'MEDIUM', 'HARD']);
  const allowedLevelTags = new Set(SUBJECT_CONFIG.LEVEL_TAGS || ['TECHNICAL', 'MANAGERIAL', 'ICEBREAKER']);

  allQuestions.forEach((q, index) => {
    if (!q || typeof q !== 'object') {
      errors.push(`Question at index ${index} is not an object.`);
      return;
    }

    const qId = q.id && typeof q.id === 'string' ? q.id.trim() : null;
    if (qId) {
      if (questionIds.has(qId)) {
        errors.push(`Duplicate question id "${qId}" detected in bundle.`);
      }
      questionIds.add(qId);
    }

    const qText = q.questionText && typeof q.questionText === 'string' ? q.questionText.trim() : null;
    if (!qText) {
      errors.push(`Question ${qId || `at index ${index}`} missing non-empty "questionText".`);
    }

    const diff = (q.difficulty || 'MEDIUM').toUpperCase();
    if (!allowedDifficulties.has(diff)) {
      errors.push(
        `Question ${qId || `at index ${index}`} has invalid difficulty "${q.difficulty}". Allowed: ${Array.from(
          allowedDifficulties
        ).join(', ')}`
      );
    }

    const level = (q.levelTag || 'TECHNICAL').toUpperCase();
    if (!allowedLevelTags.has(level)) {
      errors.push(
        `Question ${qId || `at index ${index}`} has invalid levelTag "${q.levelTag}". Allowed: ${Array.from(
          allowedLevelTags
        ).join(', ')}`
      );
    }

    // Scorable questions require idealAnswer and non-empty keywords
    if (level !== 'ICEBREAKER') {
      if (!q.idealAnswer || typeof q.idealAnswer !== 'string' || !q.idealAnswer.trim()) {
        errors.push(`Question ${qId || `at index ${index}`} requires non-empty "idealAnswer".`);
      }
      if (!Array.isArray(q.keywords) || q.keywords.length === 0) {
        errors.push(`Question ${qId || `at index ${index}`} requires non-empty "keywords" array.`);
      }

      // Must belong to one of the bundle's topics or exist by ID
      if (!q.topicId) {
        errors.push(`Scorable question ${qId || `at index ${index}`} must reference a "topicId".`);
      } else if (!topicIds.has(q.topicId)) {
        warnings.push(
          `Question ${qId || `at index ${index}`} references topicId "${q.topicId}" which is not defined in this bundle's topic list.`
        );
      }
    }

    // If parentQId is specified, check forward or self reference
    if (q.parentQId) {
      if (q.parentQId === qId) {
        errors.push(`Question "${qId}" cannot be its own parentQId.`);
      }
    }

    validatedQuestions.push({
      id: qId,
      topicId: q.topicId || null,
      difficulty: diff,
      levelTag: level,
      questionText: qText,
      simplifiedText: q.simplifiedText ? q.simplifiedText.trim() : null,
      idealAnswer: q.idealAnswer ? q.idealAnswer.trim() : '',
      keywords: Array.isArray(q.keywords) ? q.keywords.map((k) => String(k).trim()).filter(Boolean) : [],
      parentQId: q.parentQId || null,
    });
  });

  // Check parentQId references resolve within bundle or DB
  const unresolvableParents = validatedQuestions
    .filter((q) => q.parentQId && !questionIds.has(q.parentQId));

  if (unresolvableParents.length > 0) {
    for (const orphan of unresolvableParents) {
      warnings.push(`Question "${orphan.id}" references parentQId "${orphan.parentQId}" which is not declared in this bundle.`);
    }
  }

  // Topic balance check against minimums
  const topicQuestionCounts = {};
  for (const t of validatedTopics) {
    topicQuestionCounts[t.id || t.name] = { EASY: 0, MEDIUM: 0, HARD: 0, total: 0 };
  }
  for (const q of validatedQuestions) {
    if (q.topicId && topicQuestionCounts[q.topicId]) {
      topicQuestionCounts[q.topicId][q.difficulty]++;
      topicQuestionCounts[q.topicId].total++;
    }
  }

  const minPerDiff = SUBJECT_CONFIG.MIN_QUESTIONS_PER_DIFFICULTY || { EASY: 1, MEDIUM: 1, HARD: 1 };
  for (const [tKey, counts] of Object.entries(topicQuestionCounts)) {
    for (const diff of ['EASY', 'MEDIUM', 'HARD']) {
      if (counts[diff] < minPerDiff[diff]) {
        warnings.push(`Topic "${tKey}" has ${counts[diff]} ${diff} questions in bundle (minimum recommended: ${minPerDiff[diff]}).`);
      }
    }
  }

  const preview = {
    subjectName: subject?.name || 'Unnamed',
    subjectId: subject?.id || null,
    topics: validatedTopics.map((t) => ({
      ...t,
      questionCount: topicQuestionCounts[t.id || t.name]?.total || 0,
      breakdown: topicQuestionCounts[t.id || t.name] || { EASY: 0, MEDIUM: 0, HARD: 0 },
    })),
    totalQuestions: validatedQuestions.length,
    difficulties: {
      EASY: validatedQuestions.filter((q) => q.difficulty === 'EASY').length,
      MEDIUM: validatedQuestions.filter((q) => q.difficulty === 'MEDIUM').length,
      HARD: validatedQuestions.filter((q) => q.difficulty === 'HARD').length,
    },
  };

  if (errors.length > 0) {
    return {
      valid: false,
      dryRun,
      subject: subject || null,
      topicsCount: validatedTopics.length,
      questionsCount: validatedQuestions.length,
      preview,
      errors,
      warnings,
    };
  }

  // If dryRun, return without DB mutation
  if (dryRun) {
    return {
      valid: true,
      dryRun: true,
      message: 'Bundle validated successfully. Ready for import.',
      subject: subject,
      topicsCount: validatedTopics.length,
      questionsCount: validatedQuestions.length,
      preview,
      errors: [],
      warnings,
    };
  }

  // 4. Execute Transactional Ingestion
  const result = await prisma.$transaction(async (tx) => {
    // 4a. Upsert Subject
    const upsertedSubject = await tx.subject.upsert({
      where: { name: subject.name.trim() },
      update: {
        id: subject.id || undefined,
      },
      create: {
        id: subject.id || undefined,
        name: subject.name.trim(),
      },
    });

    // 4b. Upsert Topics
    const topicIdMap = {};
    for (const t of validatedTopics) {
      const upsertedTopic = await tx.topic.upsert({
        where: {
          subjectId_name: {
            subjectId: upsertedSubject.id,
            name: t.name,
          },
        },
        update: {
          id: t.id || undefined,
        },
        create: {
          id: t.id || undefined,
          name: t.name,
          subjectId: upsertedSubject.id,
        },
      });
      if (t.id) topicIdMap[t.id] = upsertedTopic.id;
      topicIdMap[t.name] = upsertedTopic.id;
    }

    // 4c. Upsert Questions in two passes: independent roots first, then follow-ups
    const roots = validatedQuestions.filter((q) => !q.parentQId);
    const dependents = validatedQuestions.filter((q) => !!q.parentQId);

    const savedQuestions = [];

    for (const q of roots) {
      const resolvedTopicId = q.topicId ? topicIdMap[q.topicId] || q.topicId : null;
      const saved = await tx.question.upsert({
        where: { id: q.id || 'new-uuid-placeholder' },
        update: {
          topicId: resolvedTopicId,
          difficulty: q.difficulty,
          levelTag: q.levelTag,
          questionText: q.questionText,
          simplifiedText: q.simplifiedText,
          idealAnswer: q.idealAnswer,
          keywords: q.keywords,
          parentQId: null,
          source: 'BANK',
          status: 'ACTIVE',
        },
        create: {
          id: q.id || undefined,
          topicId: resolvedTopicId,
          difficulty: q.difficulty,
          levelTag: q.levelTag,
          questionText: q.questionText,
          simplifiedText: q.simplifiedText,
          idealAnswer: q.idealAnswer,
          keywords: q.keywords,
          parentQId: null,
          source: 'BANK',
          status: 'ACTIVE',
        },
      });
      savedQuestions.push(saved);
    }

    for (const q of dependents) {
      const resolvedTopicId = q.topicId ? topicIdMap[q.topicId] || q.topicId : null;
      const saved = await tx.question.upsert({
        where: { id: q.id || 'new-uuid-placeholder' },
        update: {
          topicId: resolvedTopicId,
          difficulty: q.difficulty,
          levelTag: q.levelTag,
          questionText: q.questionText,
          simplifiedText: q.simplifiedText,
          idealAnswer: q.idealAnswer,
          keywords: q.keywords,
          parentQId: q.parentQId,
          source: 'BANK',
          status: 'ACTIVE',
        },
        create: {
          id: q.id || undefined,
          topicId: resolvedTopicId,
          difficulty: q.difficulty,
          levelTag: q.levelTag,
          questionText: q.questionText,
          simplifiedText: q.simplifiedText,
          idealAnswer: q.idealAnswer,
          keywords: q.keywords,
          parentQId: q.parentQId,
          source: 'BANK',
          status: 'ACTIVE',
        },
      });
      savedQuestions.push(saved);
    }

    return {
      subject: upsertedSubject,
      topicsCount: validatedTopics.length,
      questionsCount: savedQuestions.length,
    };
  });

  return {
    valid: true,
    dryRun: false,
    message: `Successfully imported subject "${result.subject.name}" with ${result.topicsCount} topics and ${result.questionsCount} questions.`,
    subject: result.subject,
    topicsCount: result.topicsCount,
    questionsCount: result.questionsCount,
    preview,
    errors: [],
    warnings,
  };
}

module.exports = {
  importSubjectBundle,
};

