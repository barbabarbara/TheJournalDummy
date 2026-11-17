/* ========== THE JOURNAL — ARTICLE PAGE ========== */
/* Load one article and its comments; support POST, PATCH/PUT and DELETE. */

// Reuse the tested API service rather than calling fetch() here.
import {
  fetchCommentsByPostId,
  fetchPostById,
  createComment,
  updatePost,
  deletePost,
} from "../services/api.js";
import {
  applySavedPost,
  isDeleted,
  savePostEdit,
  savePostDeletion,
  getSavedComments,
  saveComment,
  resetDemoData,
} from "../shared/storage.js";


/* ========== 01. DOM ELEMENTS ========== */

const article = document.querySelector("#post-article");
const postNumber = document.querySelector("#post-number");
const postTitle = document.querySelector("#post-title");
const postMeta = document.querySelector("#post-meta");
const postStatus = document.querySelector("#post-status");
const postContent = document.querySelector("#post-content");
const postTags = document.querySelector("#post-tags");
const postFooter = document.querySelector("#post-footer");

const postError = document.querySelector("#post-error");
const postErrorMessage = document.querySelector("#post-error-message");
const retryPostButton = document.querySelector("#retry-post");

const commentsSection = document.querySelector("#comments");
const commentsList = document.querySelector("#comments-list");
const commentsCount = document.querySelector("#comments-count");
const commentsError = document.querySelector("#comments-error");
const commentsErrorMessage = document.querySelector("#comments-error-message");
const retryCommentsButton = document.querySelector("#retry-comments");
const editButton = document.querySelector("#edit-post");
const deleteButton = document.querySelector("#delete-post");
const resetDemoButton = document.querySelector("#reset-demo");
const deleteFeedback = document.querySelector("#delete-feedback");
const editor = document.querySelector("#editor");
const editForm = document.querySelector("#edit-form");
const editTitle = document.querySelector("#edit-title");
const editBody = document.querySelector("#edit-body");
const editTags = document.querySelector("#edit-tags");
const editMethod = document.querySelector("#edit-method");
const editFeedback = document.querySelector("#edit-feedback");
const saveButton = document.querySelector("#save-post");
const cancelEditButton = document.querySelector("#cancel-edit");
const closeEditorButton = document.querySelector("#close-editor");
const commentForm = document.querySelector("#comment-form");
const commentBody = document.querySelector("#comment-body");
const commentFeedback = document.querySelector("#comment-feedback");
const submitCommentButton = document.querySelector("#submit-comment");
let currentPost = null;
let currentComments = [];

/* ========== 02. READ AND VALIDATE THE POST ID ========== */

/**
 * Return a positive, safe integer from ?id=12.
 * Reject missing IDs, duplicate IDs, decimals, spaces, and non-numbers.
 *
 * @returns {number|null} A valid post ID or null.
 */
function getPostId() {
  const params = new URLSearchParams(window.location.search);
  const ids = params.getAll("id");

  // Exactly one ID is required. The first digit cannot be zero.
  if (ids.length !== 1 || !/^[1-9]\d*$/.test(ids[0])) {
    return null;
  }

  const id = Number(ids[0]);
  return Number.isSafeInteger(id) ? id : null;
}

// Read this once. Clicking Retry must request the same article.
const postId = getPostId();

/* ========== 03. CREATE SAFE DOM ELEMENTS ========== */

/**
 * Create a DOM element and insert plain text safely.
 * API text must never be interpreted as HTML.
 *
 * @param {string} tagName - HTML element name.
 * @param {string} className - Optional CSS class.
 * @param {string} text - Optional text content.
 * @returns {HTMLElement} The newly created element.
 */
function createElement(tagName, className = "", text = "") {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

/**
 * Display a message when the article cannot be loaded.
 * The Retry button is hidden for permanent invalid/404 IDs.
 *
 * @param {string} message - Accessible error message.
 * @param {boolean} canRetry - Whether another request may help.
 */
function showPostError(message, canRetry = false) {
  article.setAttribute("aria-busy", "false");
  article.hidden = true;
  commentsSection.hidden = true;
  postErrorMessage.textContent = message;
  postError.hidden = false;
  retryPostButton.hidden = !canRetry;
  retryPostButton.disabled = false;
  document.title = "Story unavailable | The Journal";
}

/* ========== 05. RENDER THE FULL ARTICLE ========== */

/**
 * Replace the design placeholders with the selected API article.
 *
 * @param {Object} post - Article returned by DummyJSON.
 */
function renderArticle(post) {
  postNumber.textContent = `STORY / ${String(post.id).padStart(3, "0")}`;
  postTitle.textContent = post.title;

  // Display a real author ID; DummyJSON posts don't include author names.
  const authorId = post.userId ?? "unknown";
  const authorBadge = createElement(
    "span",
    "author-badge",
    String(authorId).slice(0, 2).toUpperCase(),
  );
  authorBadge.setAttribute("aria-hidden", "true");

  const author = createElement("span", "meta-author", `Author #${authorId}`);
  const dot1 = createElement("span", "meta-dot", "·");
  dot1.setAttribute("aria-hidden", "true");
  const views = createElement("span", "", `${post.views ?? 0} views`);
  const dot2 = createElement("span", "meta-dot", "·");
  dot2.setAttribute("aria-hidden", "true");
  const likes = createElement(
    "span",
    "",
    `♥ ${post.reactions?.likes ?? 0} likes`,
  );
  postMeta.replaceChildren(authorBadge, author, dot1, views, dot2, likes);
  postMeta.hidden = false;

  // Never truncate the article body on the details page.
  // If the API includes blank lines, preserve them as paragraphs.
  const paragraphs = post.body.split(/\n\s*\n/);
  const fragment = document.createDocumentFragment();

  for (const paragraph of paragraphs) {
    if (paragraph.trim()) {
      fragment.append(createElement("p", "article-body", paragraph.trim()));
    }
  }
  postContent.replaceChildren(fragment);

  // Show all article tags, not just the first three used on the homepage.
  const tagFragment = document.createDocumentFragment();
  for (const tag of Array.isArray(post.tags) ? post.tags : []) {
    tagFragment.append(createElement("span", "tag", tag));
  }
  postTags.replaceChildren(tagFragment);

  postFooter.hidden = false;
  editButton.disabled = false;
  deleteButton.disabled = false;
  deleteFeedback.hidden = true;

  // Remove the loading message after the article is ready.
  postStatus.hidden = true;
  article.setAttribute("aria-busy", "false");
  document.title = `${post.title} | The Journal`;
}

/* ========== 06. RENDER MATCHING COMMENTS ========== */

/**
 * Create one safe comment card, matching the existing CSS design.
 *
 * @param {Object} comment - Comment returned by DummyJSON.
 * @returns {HTMLElement} The completed comment element.
 */
function createCommentCard(comment) {
  const card = createElement("article", "comment");
  const name = comment.user?.fullName || comment.user?.username || "Anonymous";

  const avatar = createElement(
    "span",
    "comment-avatar",
    String(name).slice(0, 1).toUpperCase(),
  );
  avatar.setAttribute("aria-hidden", "true");

  const content = createElement("div", "comment-content");
  const top = createElement("div", "comment-top");
  top.append(createElement("h3", "comment-author", name));

  const body = createElement("p", "comment-text", comment.body ?? "");
  const likes = createElement(
    "span",
    "comment-likes",
    `♥ ${comment.likes ?? 0} likes`,
  );

  content.append(top, body, likes);
  card.append(avatar, content);
  return card;
}

/**
 * Display the API comments, or an explicit empty state.
 *
 * @param {Array} comments - Comments for the current post.
 */
function renderComments(comments) {
  currentComments = comments;
  commentsCount.textContent = `(${comments.length})`;

  if (comments.length === 0) {
    commentsList.replaceChildren(
      createElement("p", "loading-copy", "No comments yet on this story."),
    );
  } else {
    const fragment = document.createDocumentFragment();
    for (const comment of comments) {
      fragment.append(createCommentCard(comment));
    }
    commentsList.replaceChildren(fragment);
  }

  commentsList.setAttribute("aria-busy", "false");
}

/* ========== 07. LOAD COMMENTS ========== */

/**
 * Load comments separately; a comment error must not hide the article.
 *
 * @returns {Promise<void>}
 */
async function loadComments() {
  if (commentsList.getAttribute("aria-busy") === "true") return;

  commentsError.hidden = true;
  retryCommentsButton.disabled = true;
  commentsList.setAttribute("aria-busy", "true");
  commentsList.replaceChildren(
    createElement("p", "loading-copy", "Loading comments…"),
  );
  commentsCount.textContent = "";

  try {
    const allComments = await fetchCommentsByPostId(postId);

    // Be defensive: never show comments from a different article.
    const matchingComments = allComments.filter(
      (comment) => comment?.postId === postId,
    );
    // Keep previously posted demo comments visible after refresh.
    renderComments([...matchingComments, ...getSavedComments(postId)]);
  } catch (error) {
    commentsList.replaceChildren(
      createElement("p", "loading-copy", "Comments could not be loaded."),
    );
    commentsErrorMessage.textContent =
      `Unable to load comments: ${error.message} Please try again.`;
    commentsError.hidden = false;
  } finally {
    commentsList.setAttribute("aria-busy", "false");
    retryCommentsButton.disabled = false;
  }
}

/* ========== 08. LOAD ARTICLE ========== */

/**
 * Fetch the article. Comments load only if it succeeds.
 *
 * @returns {Promise<void>}
 */
async function loadPost() {
  if (postId === null) {
    showPostError("Missing or invalid story ID. Return to All Stories.");
    return;
  }

  if (article.getAttribute("aria-busy") === "true") return;

  article.hidden = false;
  postError.hidden = true;
  retryPostButton.disabled = true;
  commentsSection.hidden = true;

  article.setAttribute("aria-busy", "true");
  postNumber.textContent = "LOADING STORY";
  postTitle.textContent = "Loading story…";
  postStatus.hidden = false;
  postStatus.textContent = "Retrieving article details…";
  postMeta.hidden = true;
  postFooter.hidden = true;
  postContent.replaceChildren();

  try {
    if (isDeleted(postId)) {
      showPostError("This story was deleted in this browser. Return to All Stories.");
      return;
    }
    const apiPost = await fetchPostById(postId);
    const post = applySavedPost(apiPost);

    // Protect the page from unexpected API data.
    if (
      !post ||
      post.id !== postId ||
      typeof post.title !== "string" ||
      typeof post.body !== "string"
    ) {
      throw new Error("The API returned invalid article data.");
    }

    currentPost = post;
    renderArticle(post);
    commentsSection.hidden = false;
    commentBody.disabled = false;
    submitCommentButton.disabled = false;

    // Run only after the article has been rendered.
    await loadComments();
  } catch (error) {
    if (/^HTTP 404\b/.test(error.message)) {
      showPostError("This story was not found (404). Select another story.");
    } else {
      showPostError(`Unable to load this story: ${error.message}`, true);
      console.error("Could not load article:", error);
    }
  } finally {
    retryPostButton.disabled = false;
    article.setAttribute("aria-busy", "false");
  }
}

/* ========== 09. COMMENTS, EDITING AND DELETION ========== */

function showFormFeedback(element, message, isError = false) {
  element.textContent = message;
  element.hidden = false;
  element.dataset.status = isError ? "error" : "success";
}

function hideEditor() {
  editor.hidden = true;
  editFeedback.hidden = true;
}

function openEditor() {
  if (!currentPost) return;
  editTitle.value = currentPost.title;
  editBody.value = currentPost.body;
  editTags.value = (currentPost.tags ?? []).join(", ");
  editMethod.value = "PATCH";
  editFeedback.hidden = true;
  editor.hidden = false;
  editTitle.focus();
}

editButton.addEventListener("click", openEditor);
cancelEditButton.addEventListener("click", hideEditor);
closeEditorButton.addEventListener("click", hideEditor);

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentPost || !editForm.reportValidity()) return;

  const payload = {
    title: editTitle.value.trim(),
    body: editBody.value.trim(),
    tags: editTags.value.split(",").map((tag) => tag.trim()).filter(Boolean),
  };

  saveButton.disabled = true;
  editFeedback.hidden = true;
  try {
    // DummyJSON confirms the request but does not persist it remotely.
    await updatePost(postId, payload, editMethod.value);
    currentPost = { ...currentPost, ...payload };
    const stored = savePostEdit(postId, payload);
    renderArticle(currentPost);
    showFormFeedback(
      editFeedback,
      stored
        ? "Story updated. This demo change is saved in your browser."
        : "Story updated, but browser storage is unavailable; it may reset after refresh.",
    );
  } catch (error) {
    showFormFeedback(editFeedback, `Could not update story: ${error.message}`, true);
  } finally {
    saveButton.disabled = false;
  }
});

deleteButton.addEventListener("click", async () => {
  if (!currentPost || !window.confirm("Delete this story from your local demo?")) {
    return;
  }

  deleteButton.disabled = true;
  deleteFeedback.hidden = true;
  try {
    await deletePost(postId);
    if (!savePostDeletion(postId)) {
      throw new Error(
        "The API confirmed deletion, but your browser could not save it locally.",
      );
    }
    window.location.assign("./index.html#stories");
  } catch (error) {
    showFormFeedback(
      deleteFeedback,
      `Could not finish deleting this story: ${error.message}`,
      true,
    );
    deleteButton.disabled = false;
  }
});

commentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentPost || !commentForm.reportValidity()) return;

  submitCommentButton.disabled = true;
  commentFeedback.hidden = true;
  try {
    const response = await createComment(postId, commentBody.value);
    const comment = {
      ...response,
      id: response?.id ?? Date.now(),
      postId,
      body: commentBody.value.trim(),
      user: response?.user ?? { fullName: "You (local demo)" },
      likes: response?.likes ?? 0,
    };
    const stored = saveComment(postId, comment);
    renderComments([...currentComments, comment]);
    commentForm.reset();
    showFormFeedback(
      commentFeedback,
      stored
        ? "Comment posted and saved in this browser (DummyJSON demo)."
        : "Comment posted, but browser storage is unavailable; it may reset after refresh.",
    );
  } catch (error) {
    showFormFeedback(commentFeedback, `Could not post comment: ${error.message}`, true);
  } finally {
    submitCommentButton.disabled = false;
  }
});

/* ----- Restore the complete DummyJSON demo state ----- */

resetDemoButton?.addEventListener("click", () => {
  const confirmed = window.confirm(
    "Restore all original stories and comments? " +
      "All locally saved changes will be lost.",
  );
  if (!confirmed) return;

  if (!resetDemoData()) {
    showFormFeedback(
      deleteFeedback,
      "Could not reset data: browser storage is unavailable.",
      true,
    );
    return;
  }

  // Reload this article, using the original API data.
  window.location.reload();
});

/* ========== 09. EVENTS & INITIALIZATION ========== */

retryPostButton.addEventListener("click", loadPost);
retryCommentsButton.addEventListener("click", loadComments);

// Start without a second server request when the URL is invalid.
// The static HTML has aria-busy="true" for its initial loading state.
article.setAttribute("aria-busy", "false");
commentsList.setAttribute("aria-busy", "false");
loadPost();
