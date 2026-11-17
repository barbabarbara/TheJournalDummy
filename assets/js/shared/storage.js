/* ========== BROWSER-LOCAL DEMO PERSISTENCE ========== */
/* DummyJSON simulates writes. Save only successful mutations locally. */
const STORAGE_KEY = "the-journal-demo-v1";
const EMPTY = { edits: {}, deletedIds: [], comments: {} };

function readState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || typeof parsed !== "object") return structuredClone(EMPTY);
    return {
      edits: parsed.edits && typeof parsed.edits === "object" ? parsed.edits : {},
      deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
      comments: parsed.comments && typeof parsed.comments === "object" ? parsed.comments : {},
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

function writeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn("Local storage unavailable:", error);
    return false;
  }
}

export function isDeleted(postId) {
  return readState().deletedIds.includes(postId);
}

export function applySavedPost(post) {
  if (!post || isDeleted(post.id)) return null;
  const edit = readState().edits[String(post.id)];
  return edit ? { ...post, ...edit } : post;
}

export function applySavedPosts(posts) {
  return posts.map(applySavedPost).filter(Boolean);
}

export function savePostEdit(postId, update) {
  const state = readState();
  state.edits[String(postId)] = { ...update };
  return writeState(state);
}

export function savePostDeletion(postId) {
  const state = readState();
  if (!state.deletedIds.includes(postId)) state.deletedIds.push(postId);
  delete state.edits[String(postId)];
  return writeState(state);
}

export function getSavedComments(postId) {
  return readState().comments[String(postId)] ?? [];
}

export function saveComment(postId, comment) {
  const state = readState();
  const key = String(postId);
  state.comments[key] ??= [];
  state.comments[key].push(comment);
  return writeState(state);
}

/** Remove all local demo edits, deletions and comments. Never sends an API request. */
export function resetDemoData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
