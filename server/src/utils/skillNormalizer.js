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

module.exports = {
  normalizeSkill,
  tokenizeAndStem,
  getCanonicalForm,
};

