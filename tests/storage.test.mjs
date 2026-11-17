import assert from "node:assert/strict";
import test, { beforeEach, after } from "node:test";
import {
  applySavedPost,
  applySavedPosts,
  getSavedComments,
  isDeleted,
  saveComment,
  savePostDeletion,
  savePostEdit,
  resetDemoData,
} from "../assets/js/shared/storage.js";

/** A deterministic localStorage substitute; no browser or network needed. */
const values = new Map();
const previousStorage = globalThis.localStorage;
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};

beforeEach(() => values.clear());
after(() => {
  if (previousStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = previousStorage;
});

const article = { id: 4, title: "Original", body: "Body", tags: ["news"] };

test("starts with no saved edits, deletions or comments", () => {
  assert.equal(isDeleted(4), false);
  assert.deepEqual(getSavedComments(4), []);
  assert.deepEqual(applySavedPost(article), article);
});

test("stores an edit and overlays it without mutating the API object", () => {
  assert.equal(savePostEdit(4, { title: "Updated" }), true);
  assert.deepEqual(applySavedPost(article), { ...article, title: "Updated" });
  assert.equal(article.title, "Original");
  assert.deepEqual(applySavedPost({ ...article, id: 5 }), { ...article, id: 5 });
});

test("deletion hides the article and clears its prior edit", () => {
  savePostEdit(4, { title: "Updated" });
  assert.equal(savePostDeletion(4), true);
  assert.equal(isDeleted(4), true);
  assert.equal(applySavedPost(article), null);
  assert.deepEqual(applySavedPosts([article, { id: 5, title: "Other" }]), [
    { id: 5, title: "Other" },
  ]);
  // Deleting twice must not duplicate the ID.
  savePostDeletion(4);
  const state = JSON.parse(values.get("the-journal-demo-v1"));
  assert.deepEqual(state.deletedIds, [4]);
  assert.equal(state.edits["4"], undefined);
});

test("comments remain associated with the correct article", () => {
  const first = { id: 101, body: "First" };
  const second = { id: 102, body: "Second" };
  assert.equal(saveComment(4, first), true);
  saveComment(4, second);
  assert.deepEqual(getSavedComments(4), [first, second]);
  assert.deepEqual(getSavedComments(5), []);
});

test("malformed stored JSON falls back to unchanged articles", () => {
  values.set("the-journal-demo-v1", "{broken");
  assert.deepEqual(applySavedPost(article), article);
  assert.deepEqual(getSavedComments(4), []);
});

test("unavailable localStorage reports failure without crashing", () => {
  globalThis.localStorage = {
    getItem: () => { throw new Error("Blocked"); },
    setItem: () => { throw new Error("Blocked"); },
  };
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(savePostEdit(4, { title: "Edit" }), false);
    assert.equal(isDeleted(4), false);
  } finally {
    console.warn = originalWarn;
    globalThis.localStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    };
  }
});

test("resetDemoData clears edits, deletions and saved comments", () => {
  savePostEdit(4, { title: "Edited" });
  saveComment(4, { id: 555, body: "Nice" });
  savePostDeletion(5);
  assert.equal(resetDemoData(), true);
  assert.equal(isDeleted(5), false);
  assert.deepEqual(getSavedComments(4), []);
  assert.deepEqual(applySavedPost(article), article);
});

test("reset failure is reported and does not silently succeed", () => {
  const stored = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: stored.getItem,
    setItem: stored.setItem,
    removeItem: () => { throw new Error("Storage blocked"); },
  };
  try {
    assert.equal(resetDemoData(), false);
  } finally {
    globalThis.localStorage = stored;
  }
});

test("a successful reset removes only The Journal's storage key", () => {
  values.set("other-website", "keep this");
  savePostEdit(4, { title: "Edited" });
  assert.equal(resetDemoData(), true);
  assert.equal(values.get("other-website"), "keep this");
  assert.equal(values.has("the-journal-demo-v1"), false);
});
