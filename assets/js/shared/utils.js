/* ========== CHARACTER UTILITIES ========== */

/*
 * * Shorten text to a maximum length.
 *
 * @param {string} text - Original text.
 * @param {number} maxLength - Maximum length.
 * @returns {string} Original or shortened text.
 */
export function truncateText(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}…`;
}

