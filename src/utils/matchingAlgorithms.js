/**
 * matchingAlgorithms.js
 * Master collection of string comparison and matching algorithms.
 */

/**
 * getLevenshteinDistance
 * Calculates the edit distance between two strings.
 */
export const getLevenshteinDistance = (a, b) => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

/**
 * calculateSimilarity
 * Returns a score between 0 and 1 (1 = perfect match).
 */
export const calculateSimilarity = (a, b) => {
  if (a === b) return 1.0;
  const distance = getLevenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1.0;
  return 1.0 - distance / maxLength;
};

/**
 * normalizeValue
 * Standardizes a value for comparison.
 */
export const normalizeValue = (val) => {
  if (!val) return '';
  return val.toString().toLowerCase().trim()
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .replace(/[^a-z0-9\s]/g, ''); // Remove special chars but keep spaces
};

/**
 * createComparisonKey
 * Generates an exact-match key by concatenating specified fields.
 */
export const createComparisonKey = (item, fields) => {
  return fields.map(f => normalizeValue(item[f])).join('|');
};

/**
 * matchesCriteria
 * Generic pairing logic used by Slaves.
 * config: { fields, useFuzzy, threshold, exactFields }
 */
export const matchesCriteria = (itemA, itemB, config) => {
  if (!itemA || !itemB || itemA.id === itemB.id) return false;

  const { fields = [], useFuzzy = false, threshold = 0.85, exactFields = [] } = config;

  // 1. Mandatory Exact Fields (e.g., Phone must match exactly even if Name is fuzzy)
  for (const field of exactFields) {
    const valA = normalizeValue(itemA[field]);
    const valB = normalizeValue(itemB[field]);
    if (!valA || !valB || valA !== valB) return false;
  }

  // 2. Fuzzy or Exact Matching for primary fields
  if (useFuzzy) {
    // Only supports fuzzy matching on the first field usually (e.g. Name)
    const valA = normalizeValue(itemA[fields[0]]);
    const valB = normalizeValue(itemB[fields[0]]);
    if (calculateSimilarity(valA, valB) < threshold) return false;
  } else {
    // Exact match key for all specified fields
    const keyA = createComparisonKey(itemA, fields);
    const keyB = createComparisonKey(itemB, fields);
    if (!keyA || !keyB || keyA !== keyB) return false;
  }

  return true;
};
