/**
 * @file skillNormalizer.js
 * @description Skill normalization, canonicalization, and stemming utilities.
 * Preprocesses skill strings, expands domain abbreviations/synonyms, and extracts stems.
 */

const natural = require('natural');
const synonyms = require('../data/skillSynonyms.json');

/**
 * Normalizes a raw skill string by converting to lowercase, removing non-alphanumeric
 * punctuation, and collapsing consecutive whitespaces.
 *
 * @param {string} text - Raw skill string.
 * @returns {string} Clean, normalized string.
 */
function normalizeSkill(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .toLowerCase()
    // Replace non-alphanumeric characters (keep numbers and spaces) with a space
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Tokenizes a text string and applies Porter stemming to each token.
 *
 * @param {string} text - Normalized or raw skill text.
 * @returns {string[]} Array of lowercased, stemmed tokens.
 */
function tokenizeAndStem(text) {
  const normalized = normalizeSkill(text);
  if (!normalized) return [];

  return normalized
    .split(' ')
    .filter((token) => token.length > 0)
    .map((token) => natural.PorterStemmer.stem(token));
}

/**
 * Resolves a skill string to its canonical form using the domain synonym/abbreviation dictionary.
 * Checks for direct matches, parenthetical acronym extractions, and mapped phrases.
 *
 * @param {string} text - Raw or normalized skill name.
 * @returns {string} Canonicalized skill string, or the normalized string if no synonym is matched.
 */
function getCanonicalForm(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const rawLower = text.toLowerCase().trim();

  // 1. Direct dictionary lookup of raw lower (handles "v&v", "do-178c", "mil-std-1553b")
  if (synonyms[rawLower]) {
    return synonyms[rawLower];
  }

  // 2. Normalized lookup (punctuation-stripped)
  const normalized = normalizeSkill(text);
  if (synonyms[normalized]) {
    return synonyms[normalized];
  }

  // 3. Check for acronyms in parentheses e.g. "Model-Based Systems Engineering (MBSE)"
  const parentheticalMatch = text.match(/\(([^)]+)\)/);
  if (parentheticalMatch && parentheticalMatch[1]) {
    const acronym = parentheticalMatch[1].toLowerCase().trim();
    if (synonyms[acronym]) {
      return synonyms[acronym];
    }
    const normAcronym = normalizeSkill(acronym);
    if (synonyms[normAcronym]) {
      return synonyms[normAcronym];
    }
  }

  // 4. Check if stripping parenthetical expressions matches a synonym
  const strippedParentheses = normalizeSkill(text.replace(/\([^)]*\)/g, ' '));
  if (synonyms[strippedParentheses]) {
    return synonyms[strippedParentheses];
  }

  // 5. Check if any known alias/synonym key matches the canonical target
  for (const [alias, canonical] of Object.entries(synonyms)) {
    const normAlias = normalizeSkill(alias);
    if (normAlias.length > 2 && (normalized === normAlias || strippedParentheses === normAlias)) {
      return canonical;
    }
  }

  // Fallback to normalized text
  return normalized;
}

const STOPWORD_SET = new Set(natural.stopwords);
const PROSE_STOPWORD_SET = new Set(
  natural.stopwords.filter((word) => word.length > 1 || word === 'a' || word === 'i')
);

/**
 * Escapes special regex metacharacters in a string.
 *
 * @param {string} value - Raw string to escape.
 * @returns {string} Regex-escaped string.
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Precompile single-pass synonym expansion regex sorted longest-first
const SORTED_SYNONYM_KEYS = Object.keys(synonyms).sort((a, b) => b.length - a.length);
const SYNONYM_REGEX =
  SORTED_SYNONYM_KEYS.length > 0
    ? new RegExp(
        `(?<![a-z0-9])(${SORTED_SYNONYM_KEYS.map(escapeRegExp).join('|')})(?![a-z0-9])`,
        'gi'
      )
    : null;

/**
 * Expands known domain abbreviations and synonyms in free text using a single-pass regex.
 * Preserves original tokens while adding canonical expansions when the canonical form introduces
 * additional non-stopword stems (e.g., "V&V" -> "V&V verification and validation").
 *
 * @param {string} text - Raw free-text input.
 * @returns {string} Text with domain abbreviations/synonyms expanded.
 */
function expandSynonymsInText(text) {
  if (!text || typeof text !== 'string' || !SYNONYM_REGEX) {
    return typeof text === 'string' ? text : '';
  }

  return text.replace(SYNONYM_REGEX, (match) => {
    const canonical = synonyms[match.toLowerCase()];
    if (!canonical) {
      return match;
    }

    const matchStems = new Set(
      normalizeSkill(match)
        .split(' ')
        .filter((t) => t.length > 0 && !STOPWORD_SET.has(t))
        .map((t) => natural.PorterStemmer.stem(t))
    );
    const canonicalStems = normalizeSkill(canonical)
      .split(' ')
      .filter((t) => t.length > 0 && !STOPWORD_SET.has(t))
      .map((t) => natural.PorterStemmer.stem(t));

    const introducesNewTerms = canonicalStems.some((stem) => !matchStems.has(stem));
    if (!introducesNewTerms) {
      return match;
    }

    return `${match} ${canonical}`;
  });
}

/**
 * Preprocesses free text into normalized non-stopword tokens, Porter stems, and linguistic metrics.
 * Applies Part 2 synonym expansion and normalization before stopword removal and stemming.
 *
 * @param {string} text - Raw text (question, ideal answer, or candidate answer).
 * @param {{ maxWords?: number }} [options={}] - Optional preprocessing constraints.
 * @returns {{
 *   rawWordCount: number,
 *   proseStopwordCount: number,
 *   proseStopwordRatio: number,
 *   commaCount: number,
 *   truncated: boolean,
 *   expandedText: string,
 *   tokens: string[],
 *   stems: string[]
 * }} Structured preprocessing output and raw text diagnostics.
 */
function preprocessText(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return {
      rawWordCount: 0,
      proseStopwordCount: 0,
      proseStopwordRatio: 0,
      commaCount: 0,
      truncated: false,
      expandedText: '',
      tokens: [],
      stems: [],
    };
  }

  const rawNormalized = normalizeSkill(text);
  const rawTokens = rawNormalized ? rawNormalized.split(' ').filter(Boolean) : [];
  const rawWordCount = text
    .trim()
    .split(/\s+/)
    .filter((token) => /[a-z0-9]/i.test(token)).length;

  let proseStopwordCount = 0;
  for (const token of rawTokens) {
    if (PROSE_STOPWORD_SET.has(token)) {
      proseStopwordCount += 1;
    }
  }
  const proseStopwordRatio = rawTokens.length > 0 ? proseStopwordCount / rawTokens.length : 0;
  const commaCount = (text.match(/[,;]/g) || []).length;

  // Enforce optional raw word cap prior to synonym expansion to limit length padding
  let workingText = text;
  let truncated = false;
  if (options.maxWords && options.maxWords > 0) {
    const whitespaceWords = text.trim().split(/\s+/);
    if (whitespaceWords.length > options.maxWords) {
      workingText = whitespaceWords.slice(0, options.maxWords).join(' ');
      truncated = true;
    }
  }

  const expandedText = expandSynonymsInText(workingText);
  const expandedNormalized = normalizeSkill(expandedText);
  const tokens = expandedNormalized
    ? expandedNormalized.split(' ').filter((t) => t.length > 0 && !STOPWORD_SET.has(t))
    : [];
  const stems = tokens.map((token) => natural.PorterStemmer.stem(token));

  return {
    rawWordCount,
    proseStopwordCount,
    proseStopwordRatio,
    commaCount,
    truncated,
    expandedText,
    tokens,
    stems,
  };
}

module.exports = {
  normalizeSkill,
  tokenizeAndStem,
  getCanonicalForm,
  expandSynonymsInText,
  preprocessText,
  STOPWORD_SET,
};

