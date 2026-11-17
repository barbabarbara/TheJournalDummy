import assert from "node:assert/strict";
import test from "node:test";
import { truncateText } from "../assets/js/shared/utils.js";
import { validatePostUpdate } from "../assets/js/shared/validators.js";

/* ========== THE JOURNAL — TEXT & VALIDATION UNIT TESTS ========== */
/* Run: npm test
 * No network access or browser is required.
 * Both previews and validation now use JavaScript UTF-16 .length.
 */

test("truncateText leaves shorter text unchanged", () => {
  assert.equal(truncateText("Hello", 10), "Hello");
});

test("truncateText leaves text at the limit unchanged", () => {
  assert.equal(truncateText("Hello", 5), "Hello");
});

test("truncateText shortens text and adds an ellipsis", () => {
  assert.equal(truncateText("Hello world", 5), "Hello…");
});

test("truncateText removes trailing whitespace before the ellipsis", () => {
  assert.equal(truncateText("Hello   world", 7), "Hello…");
});

test("truncateText does not modify the original string", () => {
  const original = "Long article description";
  assert.equal(truncateText(original, 4), "Long…");
  assert.equal(original, "Long article description");
});

test("truncateText uses UTF-16 code-unit length for previews", () => {
  // 87 emojis use 174 UTF-16 code units, leaving room for one letter.
  const body = `${"😀".repeat(87)}XYZ`;
  assert.equal(body.length, 177);
  assert.equal(truncateText(body, 175), `${"😀".repeat(87)}X…`);
});

test("title validation accepts exactly 150 code units", () => {
  assert.doesNotThrow(() => validatePostUpdate({ title: "A".repeat(150) }));
});

test("title validation rejects more than 150 code units", () => {
  assert.throws(
    () => validatePostUpdate({ title: "A".repeat(151) }),
    /title must contain 1–150 characters/,
  );
});

test("title validation counts emojis as two UTF-16 code units", () => {
  assert.equal("😀".length, 2);
  assert.doesNotThrow(() => validatePostUpdate({ title: "😀".repeat(75) }));
  assert.throws(
    () => validatePostUpdate({ title: "😀".repeat(76) }),
    /title must contain 1–150 characters/,
  );
});

test("body validation uses a 10000-code-unit limit", () => {
  assert.doesNotThrow(() => validatePostUpdate({ body: "A".repeat(10000) }));
  assert.throws(
    () => validatePostUpdate({ body: "A".repeat(10001) }),
    /body must contain 1–10000 characters/,
  );
});

test("tag validation uses a 30-code-unit limit", () => {
  assert.doesNotThrow(() => validatePostUpdate({ tags: ["😀".repeat(15)] }));
  assert.throws(
    () => validatePostUpdate({ tags: ["😀".repeat(16)] }),
    /Each tag must contain 1–30 characters/,
  );
});

test("validation trims surrounding whitespace before length checks", () => {
  assert.doesNotThrow(() => validatePostUpdate({ title: `  ${"A".repeat(150)}  ` }));
  assert.doesNotThrow(() => validatePostUpdate({ tags: [` ${"A".repeat(30)} `] }));
});
