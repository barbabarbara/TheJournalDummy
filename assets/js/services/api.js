/* ========== THE JOURNAL — API SERVICE ========== */

import {
  validatePostId,
  validateComment,
  validatePostUpdate,
  normalizePostUpdate,
} from "../shared/validators.js";

/* Base address of the DummyJSON REST API. */
const API_BASE_URL = "https://dummyjson.com";

/**
 * Send an HTTP request and return parsed JSON data.
 *
 * Supports GET, POST, PATCH, PUT, and DELETE requests.
 *
 * @param {string} endpoint - The API endpoint.
 * @param {RequestInit} [options={}] - Fetch request settings.
 * @returns {Promise<unknown>} The parsed response data.
 */
async function apiRequest(endpoint, options = {}) {
  // Build the complete URL using the API base address.
  const url = `${API_BASE_URL}${endpoint}`;

  // Create headers while preserving custom headers.
  const headers = new Headers(options.headers);

  // Add the JSON content type when sending a request body.
  if (options.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response;

  try {
    // Send the HTTP request using the supplied options.
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    // Handle failed fetch requests without hiding
    // unrelated programming or JSON parsing errors.
    throw new Error("Unable to contact the API server.", {
      cause: error,
    });
  }

  // Reject unsuccessful HTTP responses.
  if (!response.ok) {
    // Use a fallback when the server provides no status text.
    const message = response.statusText || "Request failed";

    throw new Error(`HTTP ${response.status}: ${message}`);
  }

  // Some successful responses contain no body.
  if (response.status === 204) {
    return null;
  }

  try {
    // Parse the successful response body as JSON.
    return await response.json();
  } catch (error) {
    // Keep JSON parsing failures separate from network errors.
    throw new Error("The API returned invalid JSON.", {
      cause: error,
    });
  }
}

/**
 * Fetch all blog posts from DummyJSON.
 *
 * @returns {Promise<Array>} An array of post objects.
 */
export async function fetchPosts() {
  // Retrieve the API response containing all posts.
  const data = await apiRequest("/posts?limit=0");

  // Verify that the response contains a posts array.
  if (!Array.isArray(data?.posts)) {
    throw new Error("The API returned an invalid posts array.");
  }

  // Return only the posts array.
  return data.posts;
}

/**
 * Fetch a single blog post by its ID.
 *
 * @param {number} postId - The ID of the requested post.
 * @returns {Promise<Object>} The requested post object.
 */
export async function fetchPostById(postId) {
  // Reject invalid IDs before sending a request.
  validatePostId(postId);

  // Request the selected post.
  return apiRequest(`/posts/${postId}`);
}

/**
 * Fetch all comments belonging to a specific post.
 *
 * @param {number} postId - The ID of the blog post.
 * @returns {Promise<Array>} An array of comment objects.
 */
export async function fetchCommentsByPostId(postId) {
  // Reject invalid IDs before sending a request.
  validatePostId(postId);

  // Request all comments belonging to the selected post.
  const data = await apiRequest(`/comments/post/${postId}?limit=0`);

  // Verify that the response contains a comments array.
  if (!Array.isArray(data?.comments)) {
    throw new Error("The API returned an invalid comments array.");
  }

  // Return only the comments array.
  return data.comments;
}

/**
 * Create a new comment for a blog post.
 *
 * DummyJSON simulates creation without permanently saving data.
 *
 * @param {number} postId - The ID of the blog post.
 * @param {string} body - The comment text.
 * @returns {Promise<Object>} The simulated created comment.
 */
export async function createComment(postId, body) {
  // Validate the post ID before sending the request.
  validatePostId(postId);
  // Validate the comment text.
  validateComment(body);

  // Prepare the comment data required by DummyJSON.
  const comment = {
    body: body.trim(),
    postId,
    // For now userID: 1, I will revisit that when implementing the comments interface.
    userId: 1,
  };

  // Send the comment as JSON using an HTTP POST request.
  return apiRequest("/comments/add", {
    method: "POST",
    body: JSON.stringify(comment),
  });
}

/**
 * Update an existing blog post using PATCH or PUT.
 *
 * @param {number} postId - The ID of the post to update.
 * @param {Object} payload - The article fields to update.
 * @param {"PATCH"|"PUT"} [method="PATCH"] - HTTP method.
 * @returns {Promise<Object>} The updated post object.
 */
export async function updatePost(postId, payload, method = "PATCH") {
  // Validate the post ID and article data.
  validatePostId(postId);
  validatePostUpdate(payload);

  // Allow only supported update methods.
  if (method !== "PATCH" && method !== "PUT") {
    throw new TypeError("Update method must be PATCH or PUT.");
  }

  // Create a cleaned copy of the update data.
  const normalizedPayload = normalizePostUpdate(payload);

  // Submit the normalized data to DummyJSON.
  return apiRequest(`/posts/${postId}`, {
    method,
    body: JSON.stringify(normalizedPayload),
  });
}

/**
 * Delete a blog post by its ID.
 *
 * DummyJSON simulates deletion without permanently
 * removing the post.
 *
 * @param {number} postId - The ID of the post to delete.
 * @returns {Promise<Object>} The API deletion response.
 */
export async function deletePost(postId) {
  // Validate the post ID before sending the request.
  validatePostId(postId);

  // Send an HTTP DELETE request.
  return apiRequest(`/posts/${postId}`, {
    method: "DELETE",
  });
}
