/* ========== THE JOURNAL — VALIDATORS ========== */

/**
 * Validate that a post ID is a positive integer.
 *
 * @param {number} postId - The post ID to validate.
 * @throws {TypeError} If the post ID is invalid.
 */
export function validatePostId(postId) {
  if (!Number.isSafeInteger(postId) || postId <= 0) {
    throw new TypeError("Post ID must be a positive integer.");
  }
}

/**
 * Validate comment text before creating a comment.
 *
 * @param {string} body - The comment text.
 * @throws {TypeError} If the comment is empty or invalid.
 */
export function validateComment(body) {
  if (typeof body !== "string" || !body.trim()) {
    throw new TypeError("Comment text cannot be empty.");
  }
}

/**
 * Validate article data before a PATCH or PUT request.
 *
 * @param {Object} payload - The article fields to update.
 * @throws {TypeError} If the data is invalid.
 */
export function validatePostUpdate(payload) {
  // Define supported fields and maximum text lengths.
  const textLimits = {
    title: 150,
    body: 10000,
  };

  const allowedFields = ["title", "body", "tags"];

  // Accept only ordinary JavaScript objects.
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    Object.getPrototypeOf(payload) !== Object.prototype
  ) {
    throw new TypeError("Update data must be a plain object.");
  }

  // Retrieve the property names.
  const fields = Object.keys(payload);

  // Reject empty updates and unsupported properties.
  if (
    fields.length === 0 ||
    fields.some((field) => !allowedFields.includes(field))
  ) {
    throw new TypeError("Invalid update fields.");
  }

  // Validate the supplied values.
  for (const field of fields) {
    const value = payload[field];

    if (field === "tags") {
      // Tags must be an array containing at most 10 items.
      if (!Array.isArray(value) || value.length > 10) {
        throw new TypeError("Tags must be an array of up to 10 items.");
      }

      // Every tag must contain 1–30 characters.
      if (
        value.some(
          (tag) =>
            typeof tag !== "string" || !tag.trim() || tag.trim().length > 30,
        )
      ) {
        throw new TypeError("Each tag must contain 1–30 characters.");
      }

      // Reject duplicate tags, ignoring case and whitespace.
      const normalizedTags = value.map((tag) => tag.trim().toLowerCase());

      if (new Set(normalizedTags).size !== value.length) {
        throw new TypeError("Duplicate tags are not allowed.");
      }
    } else {
      // Validate title and body text.
      if (
        typeof value !== "string" ||
        !value.trim() ||
        value.trim().length > textLimits[field]
      ) {
        throw new TypeError(
          `${field} must contain 1–${textLimits[field]} characters.`,
        );
      }
    }
  }
}

/**
 * Normalize article data before sending it to the API.
 *
 * Creates a new object without modifying the original payload.
 *
 * @param {Object} payload - The validated article data.
 * @returns {Object} A cleaned copy of the article data.
 */
export function normalizePostUpdate(payload) {
  // Copy the original properties into a new object.
  const normalized = { ...payload };

  // Remove whitespace around the article title.
  if (normalized.title !== undefined) {
    normalized.title = normalized.title.trim();
  }

  // Remove whitespace around the article body.
  if (normalized.body !== undefined) {
    normalized.body = normalized.body.trim();
  }

  // Remove whitespace around each tag.
  if (normalized.tags !== undefined) {
    normalized.tags = normalized.tags.map((tag) => tag.trim());
  }

  // Return the cleaned object.
  return normalized;
}
