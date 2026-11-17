import assert from "node:assert/strict";
import test from "node:test";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(resolve(ROOT, relative), "utf8");
const exists = async (relative) => {
  await access(resolve(ROOT, relative));
};

test("both HTML entrypoints load the correct JavaScript modules", async () => {
  const home = await read("index.html");
  const detail = await read("post.html");
  assert.match(home, /src="\.\/assets\/js\/pages\/app\.js"/);
  assert.match(detail, /src="\.\/assets\/js\/pages\/post\.js"/);
  for (const html of [home, detail]) {
    assert.match(html, /rel="stylesheet" href="\.\/assets\/css\/styles\.css"/);
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    assert.match(html, /class="skip-link"/);
    assert.match(html, /<main\b/);
  }
});

test("homepage has its required interactive controls and ascending default", async () => {
  const html = await read("index.html");
  for (const id of [
    "posts-grid", "featured-post", "result-count", "feed-error",
    "feed-error-message", "retry-feed", "empty-state", "search",
    "tag-filter", "sort", "filters", "pagination", "prev-page",
    "next-page", "page-info", "page-numbers", "page-jump-form",
    "page-jump-input", "reset-demo", "reset-demo-status",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `Missing #${id}`);
  }
  assert.match(html, /<option value="id-asc" selected>/);
});

test("article page has the required article and CRUD controls", async () => {
  const html = await read("post.html");
  for (const id of [
    "post-article", "post-title", "post-number", "post-content", "post-tags",
    "post-error", "post-error-message", "retry-post", "comments",
    "comments-list", "comments-count", "comments-error", "retry-comments",
    "edit-post", "delete-post", "editor", "edit-form", "edit-title",
    "edit-body", "edit-tags", "edit-method", "edit-feedback", "save-post",
    "cancel-edit", "close-editor", "comment-form", "comment-body",
    "comment-feedback", "submit-comment", "delete-feedback",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `Missing #${id}`);
  }
});

test("two local editorial pictures exist, while article cards remain text-only", async () => {
  for (const path of [
    "assets/css/styles.css",
    "assets/icons/favicon.svg",
    "assets/images/editorial-magazine.webp",
    "assets/images/empty_book.webp",
  ]) await exists(path);
  const home = await read("index.html");
  const detail = await read("post.html");
  const app = await read("assets/js/pages/app.js");
  const styles = await read("assets/css/styles.css");
  assert.match(home, /src="\.\/assets\/images\/editorial-magazine\.webp"/);
  assert.match(home, /src="\.\/assets\/images\/empty_book\.webp"/);
  assert.doesNotMatch(detail, /<img\b/i);
  assert.doesNotMatch(app, /createCardVisual|findArticleImage|generate-images/);
  assert.doesNotMatch(app + detail, /api\.openverse|images\.unsplash|openai\.com\/v1\/images/);
  assert.match(styles, /\.article-visual\s*\{/);
  assert.match(app, /const PAGE_SIZE = 12;/);
});

test("source module imports resolve to files in the new tree", async () => {
  const files = [
    "assets/js/pages/app.js",
    "assets/js/pages/post.js",
    "assets/js/services/api.js",
    "assets/js/shared/storage.js",
    "assets/js/shared/utils.js",
    "assets/js/shared/validators.js",
  ];
  for (const file of files) {
    const contents = await read(file);
    const imports = contents.matchAll(/\bfrom\s+["'](\.[^"']+)["']/g);
    for (const [, target] of imports) {
      await assert.doesNotReject(
        access(resolve(dirname(resolve(ROOT, file)), target)),
        `${file}: missing import ${target}`,
      );
    }
  }
});

test("the Git ignore rules protect secrets and do not exclude tests", async () => {
  const ignore = await read(".gitignore");
  assert.match(ignore, /^node_modules\/$/m);
  assert.match(ignore, /^\.env$/m);
  assert.doesNotMatch(ignore, /^\/?tests\/$/m);
  assert.match(ignore, /^!\.env\.example$/m);
});


test("editor controls are not permanently disabled in HTML", async () => {
  const html = await read("post.html");
  for (const id of ["close-editor", "save-post", "cancel-edit"]) {
    const button = html.match(new RegExp(`<button\\b[^>]*\\bid="${id}"[^>]*>`, "s"));
    assert.ok(button, `Missing editor button #${id}`);
    assert.doesNotMatch(button[0], /\bdisabled\b/);
  }
});

// Protect against regressions caused by HTML edits and old milestone placeholders.
test("all JavaScript selectors on both pages point to unique HTML IDs", async () => {
  const pages = [
    ["index.html", "assets/js/pages/app.js"],
    ["post.html", "assets/js/pages/post.js"],
  ];
  for (const [htmlPath, jsPath] of pages) {
    const html = await read(htmlPath);
    const js = await read(jsPath);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${htmlPath} has duplicate IDs`);
    for (const [, id] of js.matchAll(/document\.querySelector\("#([a-z0-9-]+)"\)/gi)) {
      assert.ok(ids.includes(id), `${jsPath}: #${id} is missing in ${htmlPath}`);
    }
  }
});

test("reset controls are valid, available on both pages and page-owned", async () => {
  const home = await read("index.html");
  const detail = await read("post.html");
  const homepageJs = await read("assets/js/pages/app.js");
  const detailJs = await read("assets/js/pages/post.js");
  const storage = await read("assets/js/shared/storage.js");
  for (const html of [home, detail]) {
    assert.match(html, /<button\b[^>]*id="reset-demo"[^>]*>/);
  }
  assert.match(detail, /<span aria-hidden="true">↶<\/span> Reset to default/);
  assert.match(homepageJs, /resetDemoButton\?\.addEventListener\("click"/);
  assert.match(detailJs, /resetDemoButton\?\.addEventListener\("click"/);
  assert.doesNotMatch(storage, /document|window|addEventListener/);
  assert.match(storage, /localStorage\.removeItem\(STORAGE_KEY\)/);
});

test("local website assets referenced in HTML are present", async () => {
  for (const file of ["index.html", "post.html"]) {
    const html = await read(file);
    for (const [, target] of html.matchAll(/(?:src|href)="(\.\/assets\/[^"?#]+)"/g)) {
      await assert.doesNotReject(access(resolve(ROOT, target)), `${file}: missing asset ${target}`);
    }
  }
});

test("visible API error areas and responsive meta tags are present", async () => {
  const home = await read("index.html");
  const detail = await read("post.html");
  for (const html of [home, detail]) {
    assert.match(html, /name="viewport"/);
    assert.match(html, /role="alert"/);
  }
  assert.match(home, /id="feed-error"/);
  assert.match(detail, /id="post-error"/);
  assert.match(detail, /id="comments-error"/);
  assert.match(detail, /id="comment-feedback"/);
  assert.match(detail, /id="edit-feedback"/);
});
