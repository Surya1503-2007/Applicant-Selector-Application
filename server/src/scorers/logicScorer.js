/**
 * @file logicScorer.js
 * @description Deterministic, offline answer scoring engine for RAC DRDO interview responses.
 * Computes explainable relevancy (topic overlap + TF-IDF cosines), correctness (keyword coverage +
 * ideal answer similarity), applies anti-gaming rules, and produces a verdict.
 */

const prisma = require('../db/prismaClient');
const defaultConfig = require('../config/scorerConfig');
const {
  normalizeSkill,
  tokenizeAndStem,
  getCanonicalForm,
  preprocessText,
} = require('../utils/skillNormalizer');

/**
 * In-memory IDF cache built from all questions in the database.
 */
const idfCache = {
  initialized: false,
  documentCount: 0,
  idfMap: Object.create(null),
  defaultIdf: defaultConfig.TFIDF.DEFAULT_IDF_UNINITIALIZED,
  lastRefreshedAt: null,
};

/**
 * Rounds a number to the configured number of decimal places and clamps to [0, 1].
 *
 * @param {number} value - Raw score value.
 * @param {number} [decimals=4] - Decimal precision.
 * @returns {number} Clamped and rounded score in [0, 1].
 */
function roundAndClamp(value, decimals = defaultConfig.ROUNDING_DECIMALS) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const factor = Math.pow(10, decimals);
  return Math.round(clamped * factor) / factor;
}

/**
 * Deeply merges a partial config override onto defaultConfig for calibration experiments.
 *
 * @param {object} base - Base configuration object.
 * @param {object} override - Partial override object.
 * @returns {object} Merged configuration object.
 */
function mergeConfig(base, override) {
  if (!override || typeof override !== 'object') {
    return base;
  }

  const merged = { ...base };
  for (const [key, val] of Object.entries(override)) {
    if (val && typeof val === 'object' && !Array.isArray(val) && base[key] && typeof base[key] === 'object') {
      merged[key] = mergeConfig(base[key], val);
    } else if (val !== undefined) {
      merged[key] = val;
    }
  }
  return merged;
}

/**
 * Rebuilds the in-memory Inverse Document Frequency (IDF) cache from all questions in PostgreSQL
 * (or an optional array of question objects for offline unit testing/calibration).
 *
 * IDF formula (smoothed): idf(t) = 1 + ln((N + 1) / (df(t) + 1))
 *
 * @async
 * @param {Array<object>|null} [questionsOverride=null] - Optional array of question objects.
 * @returns {Promise<{ initialized: boolean, documentCount: number, vocabularySize: number, lastRefreshedAt: string }>} Cache summary.
 */
async function refreshIdf(questionsOverride = null) {
  const questions = Array.isArray(questionsOverride)
    ? questionsOverride
    : await prisma.question.findMany({
        select: {
          id: true,
          questionText: true,
          idealAnswer: true,
          keywords: true,
        },
      });

  const dfMap = Object.create(null);
  const docCount = questions.length;

  for (const q of questions) {
    const combinedText = [
      q.questionText || '',
      q.idealAnswer || '',
      Array.isArray(q.keywords) ? q.keywords.join(' ') : '',
    ].join(' ');

    const { stems } = preprocessText(combinedText);
    const uniqueStems = new Set(stems);

    for (const stem of uniqueStems) {
      dfMap[stem] = (dfMap[stem] || 0) + 1;
    }
  }

  const newIdfMap = Object.create(null);
  for (const [stem, df] of Object.entries(dfMap)) {
    newIdfMap[stem] = 1 + Math.log((docCount + 1) / (df + 1));
  }

  idfCache.initialized = true;
  idfCache.documentCount = docCount;
  idfCache.idfMap = newIdfMap;
  idfCache.defaultIdf = defaultConfig.TFIDF.DEFAULT_IDF_OOV;
  idfCache.lastRefreshedAt = new Date().toISOString();

  return getIdfCacheInfo();
}

/**
 * Ensures the IDF cache is loaded from the database before scoring if not yet initialized.
 *
 * @async
 * @returns {Promise<void>}
 */
async function ensureIdfLoaded() {
  if (!idfCache.initialized) {
    await refreshIdf();
  }
}

/**
 * Returns metadata about the current in-memory IDF cache state.
 *
 * @returns {{ initialized: boolean, documentCount: number, vocabularySize: number, lastRefreshedAt: string|null }}
 */
function getIdfCacheInfo() {
  return {
    initialized: idfCache.initialized,
    documentCount: idfCache.documentCount,
    vocabularySize: Object.keys(idfCache.idfMap).length,
    lastRefreshedAt: idfCache.lastRefreshedAt,
  };
}

/**
 * Looks up the cached IDF weight for a stemmed term.
 *
 * @param {string} stem - Porter-stemmed token.
 * @returns {number} IDF weight.
 */
function getTermIdf(stem) {
  if (!idfCache.initialized || idfCache.documentCount === 0) {
    return defaultConfig.TFIDF.DEFAULT_IDF_UNINITIALIZED;
  }
  return Object.prototype.hasOwnProperty.call(idfCache.idfMap, stem)
    ? idfCache.idfMap[stem]
    : idfCache.defaultIdf;
}

/**
 * Builds a TF-IDF weighted sparse vector (stem -> weight) from an array of stems.
 * Uses sublinear TF scaling and caps TF weight to reduce repetition gaming.
 *
 * @param {string[]} stems - Preprocessed stem sequence.
 * @param {object} config - Scorer configuration.
 * @returns {Record<string, number>} Sparse TF-IDF vector.
 */
function buildTfIdfVector(stems, config) {
  const counts = Object.create(null);
  for (const stem of stems) {
    counts[stem] = (counts[stem] || 0) + 1;
  }

  const vector = Object.create(null);
  for (const [stem, count] of Object.entries(counts)) {
    const rawTf = config.TFIDF.SUBLINEAR_TF ? 1 + Math.log(count) : count;
    const cappedTf = Math.min(rawTf, config.TFIDF.MAX_TF_WEIGHT);
    vector[stem] = cappedTf * getTermIdf(stem);
  }
  return vector;
}

/**
 * Computes cosine similarity between two stem lists using cached IDF weights.
 *
 * @param {string[]} stemsA - First stem sequence.
 * @param {string[]} stemsB - Second stem sequence.
 * @param {object} config - Scorer configuration.
 * @returns {number} Cosine similarity in [0, 1].
 */
function computeTfIdfCosine(stemsA, stemsB, config) {
  if (!stemsA.length || !stemsB.length) {
    return 0;
  }

  const vecA = buildTfIdfVector(stemsA, config);
  const vecB = buildTfIdfVector(stemsB, config);

  let dot = 0;
  let normASq = 0;
  let normBSq = 0;

  for (const wA of Object.values(vecA)) {
    normASq += wA * wA;
  }
  for (const [stem, wB] of Object.entries(vecB)) {
    normBSq += wB * wB;
    if (Object.prototype.hasOwnProperty.call(vecA, stem)) {
      dot += vecA[stem] * wB;
    }
  }

  const denom = Math.sqrt(normASq) * Math.sqrt(normBSq);
  if (denom === 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, dot / denom));
}

/**
 * Evaluates keyword coverage for a question's keywords against the candidate's answer stems.
 * Supports exact/stemmed matching, synonym canonicalization, and IDF-weighted partial credit
 * for multi-word keywords.
 *
 * @param {string[]} keywords - Question keywords array.
 * @param {Set<string>} answerStemSet - Set of unique stems in the candidate's answer.
 * @param {object} config - Scorer configuration.
 * @returns {{
 *   keywordCoverage: number,
 *   matchedKeywords: string[],
 *   partialKeywords: Array<{ keyword: string, credit: number, matchedTokens: string[] }>,
 *   missingKeywords: string[],
 *   keywordDetails: Array<{ keyword: string, status: string, credit: number, matchedTokens: string[] }>,
 *   allKeywordStems: Set<string>
 * }}
 */
function evaluateKeywordCoverage(keywords, answerStemSet, config) {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return {
      keywordCoverage: 0,
      matchedKeywords: [],
      partialKeywords: [],
      missingKeywords: [],
      keywordDetails: [],
      allKeywordStems: new Set(),
    };
  }

  const matchedKeywords = [];
  const partialKeywords = [];
  const missingKeywords = [];
  const keywordDetails = [];
  const allKeywordStems = new Set();

  let totalCredit = 0;

  for (const kw of keywords) {
    if (typeof kw !== 'string' || !kw.trim()) {
      continue;
    }

    const rawPre = preprocessText(kw);
    const rawStems = rawPre.stems.length > 0 ? rawPre.stems : tokenizeAndStem(kw);
    const uniqueRawStems = [...new Set(rawStems)];

    const canonicalPhrase = getCanonicalForm(kw);
    const canonPre = preprocessText(canonicalPhrase);
    const uniqueCanonStems = [...new Set(canonPre.stems)];

    for (const s of uniqueRawStems) allKeywordStems.add(s);
    for (const s of uniqueCanonStems) allKeywordStems.add(s);

    const matchedRawStems = uniqueRawStems.filter((s) => answerStemSet.has(s));
    const fullRawMatch = uniqueRawStems.length > 0 && matchedRawStems.length === uniqueRawStems.length;
    const fullCanonMatch =
      uniqueCanonStems.length > 0 && uniqueCanonStems.every((s) => answerStemSet.has(s));

    if (fullRawMatch || fullCanonMatch) {
      const credit = config.KEYWORD_MATCHING.FULL_MATCH_CREDIT;
      totalCredit += credit;
      matchedKeywords.push(kw);
      keywordDetails.push({
        keyword: kw,
        status: 'matched',
        credit: roundAndClamp(credit, config.ROUNDING_DECIMALS),
        matchedTokens: fullRawMatch ? matchedRawStems : uniqueCanonStems,
      });
      continue;
    }

    // Multi-word partial credit weighted by term IDF so generic words alone carry less weight
    if (uniqueRawStems.length > 1 && matchedRawStems.length > 0) {
      let matchedIdfSum = 0;
      let totalIdfSum = 0;
      for (const stem of uniqueRawStems) {
        const w = getTermIdf(stem);
        totalIdfSum += w;
        if (answerStemSet.has(stem)) {
          matchedIdfSum += w;
        }
      }

      const weightedFraction = totalIdfSum > 0 ? matchedIdfSum / totalIdfSum : 0;
      if (weightedFraction >= config.KEYWORD_MATCHING.PARTIAL_MIN_CREDIT) {
        const credit = Math.min(
          config.KEYWORD_MATCHING.FULL_MATCH_CREDIT,
          weightedFraction * config.KEYWORD_MATCHING.PARTIAL_CREDIT_FACTOR
        );
        totalCredit += credit;
        const roundedCredit = roundAndClamp(credit, config.ROUNDING_DECIMALS);
        partialKeywords.push({
          keyword: kw,
          credit: roundedCredit,
          matchedTokens: matchedRawStems,
        });
        keywordDetails.push({
          keyword: kw,
          status: 'partial',
          credit: roundedCredit,
          matchedTokens: matchedRawStems,
        });
        continue;
      }
    }

    missingKeywords.push(kw);
    keywordDetails.push({
      keyword: kw,
      status: 'missing',
      credit: 0,
      matchedTokens: [],
    });
  }

  const validCount = keywordDetails.length;
  const keywordCoverage = validCount > 0 ? totalCredit / validCount : 0;

  return {
    keywordCoverage,
    matchedKeywords,
    partialKeywords,
    missingKeywords,
    keywordDetails,
    allKeywordStems,
  };
}

/**
 * Computes topic vocabulary overlap between candidate answer stems and question topic vocabulary
 * (combined stems of questionText, keywords, and idealAnswer).
 *
 * @param {Set<string>} answerStemSet - Unique stems from candidate answer.
 * @param {Set<string>} topicVocabulary - Unique stems from question, keywords, and idealAnswer.
 * @param {object} config - Scorer configuration.
 * @returns {{ topicOverlap: number, topicPrecision: number, topicRecall: number, overlapCount: number }}
 */
function computeTopicOverlap(answerStemSet, topicVocabulary, config) {
  if (!answerStemSet.size || !topicVocabulary.size) {
    return { topicOverlap: 0, topicPrecision: 0, topicRecall: 0, overlapCount: 0 };
  }

  let overlapCount = 0;
  for (const stem of answerStemSet) {
    if (topicVocabulary.has(stem)) {
      overlapCount += 1;
    }
  }

  const topicPrecision = overlapCount / answerStemSet.size;
  const topicRecall = overlapCount / topicVocabulary.size;
  const topicOverlap =
    config.TOPIC_OVERLAP.PRECISION_WEIGHT * topicPrecision +
    config.TOPIC_OVERLAP.RECALL_WEIGHT * topicRecall;

  return { topicOverlap, topicPrecision, topicRecall, overlapCount };
}

/**
 * Checks whether a candidate's text represents an empty or explicit non-answer
 * (e.g., "", "I don't know", "no idea", "pass").
 *
 * @param {string} answerText - Raw answer text.
 * @param {object} config - Scorer configuration.
 * @returns {boolean} True if answer should be classified as NO_ANSWER.
 */
function isNoAnswer(answerText, config) {
  if (!answerText || typeof answerText !== 'string') {
    return true;
  }

  const normalized = normalizeSkill(answerText);
  if (!normalized) {
    return true;
  }

  return config.ANTI_GAMING.NO_ANSWER_PHRASES.includes(normalized);
}

/**
 * Maps an answerScore (0..1) to a verdict band using configured thresholds.
 *
 * @param {number} answerScore - Combined score in [0, 1].
 * @param {object} config - Scorer configuration.
 * @returns {'IRRELEVANT'|'PARTIAL'|'STRONG'} Verdict classification.
 */
function determineVerdict(answerScore, config) {
  if (answerScore < config.VERDICT_THRESHOLDS.IRRELEVANT_MAX) {
    return config.VERDICTS.IRRELEVANT;
  }
  if (answerScore > config.VERDICT_THRESHOLDS.STRONG_MIN) {
    return config.VERDICTS.STRONG;
  }
  return config.VERDICTS.PARTIAL;
}

/**
 * Scores a candidate's free-text answer against a Question record deterministically and offline.
 *
 * @param {{ question: object, answerText: string }} params - Question row and candidate answer text.
 * @param {object} [configOverride=null] - Optional partial config overrides (used by calibration).
 * @returns {{
 *   relevancy: number,
 *   correctness: number,
 *   answerScore: number,
 *   verdict: string,
 *   breakdown: {
 *     matchedKeywords: string[],
 *     partialKeywords: Array<{ keyword: string, credit: number, matchedTokens: string[] }>,
 *     missingKeywords: string[],
 *     keywordCoverage: number,
 *     idealAnswerSimilarity: number,
 *     questionSimilarity: number,
 *     topicOverlap: number,
 *     wordCount: number,
 *     stopwordRatio: number,
 *     keywordDensity: number,
 *     flags: string[],
 *     keywordDetails: Array<object>
 *   }
 * }} Explainable scoring evaluation.
 */
function scoreAnswer({ question, answerText }, configOverride = null) {
  if (!question || typeof question !== 'object') {
    throw new Error('A valid question object is required to score an answer.');
  }

  const config = mergeConfig(defaultConfig, configOverride);
  const precision = config.ROUNDING_DECIMALS;
  const keywords = Array.isArray(question.keywords) ? question.keywords : [];

  // 1. Empty / Explicit Non-Answer Check
  if (isNoAnswer(answerText, config)) {
    return {
      relevancy: 0,
      correctness: 0,
      answerScore: 0,
      verdict: config.VERDICTS.IRRELEVANT,
      breakdown: {
        matchedKeywords: [],
        partialKeywords: [],
        missingKeywords: [...keywords],
        keywordCoverage: 0,
        idealAnswerSimilarity: 0,
        questionSimilarity: 0,
        topicOverlap: 0,
        wordCount: 0,
        stopwordRatio: 0,
        keywordDensity: 0,
        flags: [config.FLAGS.NO_ANSWER],
        keywordDetails: keywords.map((kw) => ({
          keyword: kw,
          status: 'missing',
          credit: 0,
          matchedTokens: [],
        })),
      },
    };
  }

  // 2. Preprocess Question, Ideal Answer, Keywords, and Candidate Answer
  const questionPre = preprocessText(question.questionText || '');
  const idealPre = preprocessText(question.idealAnswer || '');
  const keywordsPre = preprocessText(keywords.join(' '));

  const answerPre = preprocessText(answerText, {
    maxWords: config.ANTI_GAMING.MAX_ANSWER_WORDS,
  });

  // Build full topic vocabulary from questionText + keywords + idealAnswer
  const topicVocabulary = new Set([
    ...questionPre.stems,
    ...keywordsPre.stems,
    ...idealPre.stems,
  ]);
  const answerStemSet = new Set(answerPre.stems);

  // 3. Core Metrics
  const { topicOverlap } = computeTopicOverlap(answerStemSet, topicVocabulary, config);
  const questionSimilarity = computeTfIdfCosine(answerPre.stems, questionPre.stems, config);
  const idealAnswerSimilarity = computeTfIdfCosine(answerPre.stems, idealPre.stems, config);

  const kwResult = evaluateKeywordCoverage(keywords, answerStemSet, config);

  // Blended raw relevancy and correctness
  let relevancy =
    config.SCORING_WEIGHTS.RELEVANCY.topicOverlap * topicOverlap +
    config.SCORING_WEIGHTS.RELEVANCY.questionSimilarity * questionSimilarity +
    config.SCORING_WEIGHTS.RELEVANCY.idealAnswerSimilarity * idealAnswerSimilarity;

  let correctness =
    config.SCORING_WEIGHTS.CORRECTNESS.keywordCoverage * kwResult.keywordCoverage +
    config.SCORING_WEIGHTS.CORRECTNESS.idealAnswerSimilarity * idealAnswerSimilarity;

  // 4. Anti-Gaming & Edge-Case Rules
  const flags = [];
  if (answerPre.truncated) {
    flags.push(config.FLAGS.LONG_ANSWER_CAPPED);
  }

  // Compute keyword token density & structural diagnostics
  let keywordTokenHits = 0;
  for (const stem of answerPre.stems) {
    if (kwResult.allKeywordStems.has(stem)) {
      keywordTokenHits += 1;
    }
  }
  const keywordDensity =
    answerPre.stems.length > 0 ? keywordTokenHits / answerPre.stems.length : 0;
  const uniqueStemRatio =
    answerPre.stems.length > 0 ? answerStemSet.size / answerPre.stems.length : 0;
  const commaRatio =
    answerPre.rawWordCount > 0 ? answerPre.commaCount / answerPre.rawWordCount : 0;

  // 4a. OFF_TOPIC rule: low topic-vocabulary overlap forces relevancy low
  if (topicOverlap < config.ANTI_GAMING.OFF_TOPIC.MIN_TOPIC_OVERLAP) {
    flags.push(config.FLAGS.OFF_TOPIC);
    relevancy = Math.min(relevancy, config.ANTI_GAMING.OFF_TOPIC.MAX_RELEVANCY);
  }

  // 4b. TOO_SHORT rule: answer below minimum word count caps scores
  if (answerPre.rawWordCount < config.ANTI_GAMING.MIN_WORD_COUNT) {
    flags.push(config.FLAGS.TOO_SHORT);
    relevancy = Math.min(relevancy, config.ANTI_GAMING.TOO_SHORT_MAX_RELEVANCY);
    correctness = Math.min(correctness, config.ANTI_GAMING.TOO_SHORT_MAX_CORRECTNESS);
  }

  // 4c. KEYWORD_STUFFING rule: high keyword density with poor sentence structure / low stopwords
  const stuffingCfg = config.ANTI_GAMING.KEYWORD_STUFFING;
  const matchedOrPartialCount =
    kwResult.matchedKeywords.length + kwResult.partialKeywords.length;
  const hasHighDensity =
    keywordDensity >= stuffingCfg.HIGH_DENSITY_THRESHOLD &&
    matchedOrPartialCount >= stuffingCfg.MIN_MATCHED_KEYWORDS;
  const hasLowStopwords = answerPre.proseStopwordRatio < stuffingCfg.MIN_STOPWORD_RATIO;
  const hasCommaListStructure =
    commaRatio >= stuffingCfg.HIGH_COMMA_RATIO &&
    answerPre.proseStopwordRatio < stuffingCfg.LIST_MAX_STOPWORD_RATIO;
  const hasLowLexicalDiversity = uniqueStemRatio < stuffingCfg.MIN_UNIQUE_STEM_RATIO;

  if (hasHighDensity && (hasLowStopwords || hasCommaListStructure || hasLowLexicalDiversity)) {
    flags.push(config.FLAGS.KEYWORD_STUFFING);
    relevancy *= stuffingCfg.PENALTY_MULTIPLIER;
    correctness *= stuffingCfg.PENALTY_MULTIPLIER;
  }

  // 5. Final Weighted Combination & Score Caps
  let answerScore =
    config.SCORING_WEIGHTS.ANSWER_SCORE.relevancy * relevancy +
    config.SCORING_WEIGHTS.ANSWER_SCORE.correctness * correctness;

  if (flags.includes(config.FLAGS.OFF_TOPIC)) {
    answerScore = Math.min(answerScore, config.ANTI_GAMING.OFF_TOPIC.MAX_SCORE);
  }
  if (flags.includes(config.FLAGS.TOO_SHORT)) {
    answerScore = Math.min(answerScore, config.ANTI_GAMING.TOO_SHORT_MAX_SCORE);
  }
  if (flags.includes(config.FLAGS.KEYWORD_STUFFING)) {
    answerScore = Math.min(answerScore, stuffingCfg.MAX_SCORE);
  }

  const finalRelevancy = roundAndClamp(relevancy, precision);
  const finalCorrectness = roundAndClamp(correctness, precision);
  const finalAnswerScore = roundAndClamp(answerScore, precision);
  const verdict = determineVerdict(finalAnswerScore, config);

  return {
    relevancy: finalRelevancy,
    correctness: finalCorrectness,
    answerScore: finalAnswerScore,
    verdict,
    breakdown: {
      matchedKeywords: kwResult.matchedKeywords,
      partialKeywords: kwResult.partialKeywords,
      missingKeywords: kwResult.missingKeywords,
      keywordCoverage: roundAndClamp(kwResult.keywordCoverage, precision),
      idealAnswerSimilarity: roundAndClamp(idealAnswerSimilarity, precision),
      questionSimilarity: roundAndClamp(questionSimilarity, precision),
      topicOverlap: roundAndClamp(topicOverlap, precision),
      wordCount: answerPre.rawWordCount,
      stopwordRatio: roundAndClamp(answerPre.proseStopwordRatio, precision),
      keywordDensity: roundAndClamp(keywordDensity, precision),
      flags,
      keywordDetails: kwResult.keywordDetails,
    },
  };
}

module.exports = {
  scoreAnswer,
  refreshIdf,
  ensureIdfLoaded,
  getIdfCacheInfo,
  determineVerdict,
};
