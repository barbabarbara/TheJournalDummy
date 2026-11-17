/**
 * The Journal — browser end-to-end tests.
 *
 * Run separately from unit tests:
 *   npm install --save-dev playwright
 *   npx playwright install chromium
 *   npm run test:browser
 *
 * Uses real Chromium, serves the local project, and mocks DummyJSON so tests
 * are repeatable, do not modify API data, and work without API credentials.
 */

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
};

const POSTS = Array.from({ length: 25 }, (_, index) => {
    const id = index + 1;
    const titles = {
        1: "The quiet forest at dawn",
        2: "City streets after dark",
        3: "The ocean at sunset",
    };
    return {
        id,
        title: titles[id] ?? `Everyday story number ${id}`,
        body:
            id === 1
                ? "Birds sing in the forest while the sun rises above the trees."
                : `The complete body text of story ${id}.`,
        tags:
            id === 1 ? ["nature", "english"] :
                id === 2 ? ["city", "history"] :
                    id === 3 ? ["nature", "travel"] : ["fiction"],
        views: id * 100,
        reactions: { likes: id * 10, dislikes: 0 },
        userId: 7,
    };
});

const COMMENTS = [
    {
        id: 101,
        postId: 1,
        body: "A helpful original comment",
        likes: 2,
        user: { fullName: "Alex Reader", username: "alex" },
    },
];

let server;
let browser;
let baseUrl;

// Start a tiny local static server: no Express or other server dependency.
before(async () => {
    server = createServer(async (request, response) => {
        try {
            const pathname = decodeURIComponent(
                new URL(request.url, "http://localhost").pathname,
            );
            const filename = resolve(ROOT, `.${pathname.endsWith("/") ? `${pathname}index.html` : pathname}`);

            // Never serve files outside the project directory.
            if (!filename.startsWith(`${ROOT}${sep}`)) {
                response.writeHead(403).end("Forbidden");
                return;
            }

            const data = await readFile(filename);
            response.writeHead(200, {
                "Content-Type": TYPES[extname(filename)] ?? "application/octet-stream",
            });
            response.end(data);
        } catch {
            response.writeHead(404).end("Not found");
        }
    });

    await new Promise((resolveListen, rejectListen) => {
        server.once("error", rejectListen);
        server.listen(0, "127.0.0.1", resolveListen);
    });

    baseUrl = `http://127.0.0.1:${server.address().port}`;

    // Optionally use a system Chromium installation in CI.
    const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
    browser = await chromium.launch({
        headless: true,
        ...(executablePath ? { executablePath } : {}),
    });
});

after(async () => {
    await browser?.close();
    if (server?.listening) {
        await new Promise((resolveClose) => server.close(resolveClose));
    }
});

/** Return fixture data or simulated REST errors without contacting DummyJSON. */
async function mockApi(page, options = {}) {
    const calls = [];
    let postListAttempts = 0;
    // The website calls a different origin, so mocked responses need CORS.
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };

    // The site uses Google Fonts, but tests should not depend on the internet.
    await page.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, (route) =>
        route.abort(),
    );

    await page.route("https://dummyjson.com/**", async (route) => {
        const request = route.request();
        const method = request.method();
        const url = new URL(request.url());
        const pathname = url.pathname;
        if (method === "OPTIONS") {
            await route.fulfill({ status: 204, headers: corsHeaders });
            return;
        }
        calls.push({ method, pathname, body: request.postDataJSON?.() });

        async function reply(value, status = 200) {
            await route.fulfill({
                status,
                contentType: "application/json",
                headers: corsHeaders,
                body: JSON.stringify(value),
            });
        }

        if (pathname === "/posts" && method === "GET") {
            postListAttempts += 1;
            if (options.failPostsOnce && postListAttempts === 1) {
                return reply({ message: "Test API unavailable" }, 503);
            }
            return reply({ posts: POSTS, total: POSTS.length, skip: 0, limit: 0 });
        }

        const postIdMatch = /^\/posts\/(\d+)$/.exec(pathname);
        if (postIdMatch) {
            const id = Number(postIdMatch[1]);
            const post = POSTS.find((candidate) => candidate.id === id);
            if (!post) return reply({ message: "Not found" }, 404);

            if (method === "GET") return reply(post);
            if ((method === "PATCH" || method === "PUT") && options.failEdit) {
                return reply({ message: "Cannot update" }, 500);
            }
            if (method === "PATCH" || method === "PUT") {
                return reply({ ...post, ...request.postDataJSON() });
            }
            if (method === "DELETE" && options.failDelete) {
                return reply({ message: "Cannot delete" }, 500);
            }
            if (method === "DELETE") {
                return reply({ ...post, isDeleted: true, deletedOn: "2026-11-17T10:00:00Z" });
            }
        }

        const commentsMatch = /^\/comments\/post\/(\d+)$/.exec(pathname);
        if (commentsMatch && method === "GET") {
            if (options.failComments) return reply({ message: "Comments offline" }, 503);
            const id = Number(commentsMatch[1]);
            const comments = COMMENTS.filter((comment) => comment.postId === id);
            return reply({ comments, total: comments.length, skip: 0, limit: 0 });
        }

        if (pathname === "/comments/add" && method === "POST") {
            if (options.failCommentPost) return reply({ message: "Cannot comment" }, 500);
            return reply({
                ...request.postDataJSON(),
                id: 300,
                likes: 0,
                user: { fullName: "You (local demo)" },
            });
        }

        return reply({ message: `Unexpected test request: ${method} ${pathname}` }, 404);
    });

    return calls;
}

/** An isolated browser context gives every test a clean localStorage state. */
async function newPage(t, options = {}) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    t.after(() => context.close());
    const page = await context.newPage();
    const calls = await mockApi(page, options);
    return { page, calls };
}

async function openHome(page) {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() =>
        document.querySelector("#posts-grid")?.getAttribute("aria-busy") === "false" &&
        document.querySelectorAll("#posts-grid .post-card").length > 0,
    );
}

async function openPost(page, id = 1) {
    await page.goto(`${baseUrl}/post.html?id=${id}`, { waitUntil: "domcontentloaded" });
    await page.locator("#post-footer").waitFor({ state: "visible" });
    await page.waitForFunction(() =>
        document.querySelector("#comments-list")?.getAttribute("aria-busy") === "false" &&
        !document.querySelector("#comments-list")?.textContent?.includes("Loading comments"),
    );
}

async function cardCount(page) {
    return page.locator("#posts-grid .post-card").count();
}

// GET + pagination: the assignment requires at least ten posts.
test("GET: homepage shows 12 stories and moves to the next page", async (t) => {
    const { page, calls } = await newPage(t);
    await openHome(page);

    assert.equal(await cardCount(page), 12);
    assert.match(await page.locator("#result-count").innerText(), /1–12 of 25/);
    assert.match(await page.locator(".card-number").first().innerText(), /001/);
    await page.locator("#next-page").click();
    assert.equal(await cardCount(page), 12);
    assert.match(await page.locator("#result-count").innerText(), /13–24 of 25/);
    assert.match(await page.locator(".card-number").first().innerText(), /013/);
    assert.ok(calls.some((call) => call.method === "GET" && call.pathname === "/posts"));
});

// VG requirements: search, filter by tag and sort by views.
test("VG: search, tag filtering, sorting and Clear filters", async (t) => {
    const { page } = await newPage(t);
    await openHome(page);

    await page.locator("#search").fill("quiet forest");
    assert.equal(await cardCount(page), 1);
    assert.match(await page.locator(".card-title").innerText(), /forest/i);

    await page.locator("#search").fill("");
    await page.locator("#tag-filter").selectOption("nature");
    assert.equal(await cardCount(page), 2);

    await page.locator("#tag-filter").selectOption("");
    await page.locator("#sort").selectOption("views-desc");
    assert.match(await page.locator(".card-number").first().innerText(), /025/);

    await page.locator("#filters button[type=reset]").click();
    await page.waitForFunction(() => document.querySelector("#sort")?.value === "id-asc");
    assert.match(await page.locator(".card-number").first().innerText(), /001/);
});

// The URL must load one article and only its comments.
test("GET: a dedicated detail page displays its full article and comments", async (t) => {
    const { page, calls } = await newPage(t);
    await openPost(page);
    assert.equal(await page.locator("#post-title").innerText(), POSTS[0].title);
    assert.match(await page.locator("#post-content").innerText(), /sun rises above the trees/);
    assert.match(await page.locator("#comments-list").innerText(), /A helpful original comment/);
    assert.ok(calls.some((call) => call.method === "GET" && call.pathname === "/posts/1"));
    assert.ok(calls.some((call) => call.method === "GET" && call.pathname === "/comments/post/1"));
});

// Successful POST must update the page and persist after refresh.
test("POST: a new comment appears only after success and survives refresh", async (t) => {
    const { page, calls } = await newPage(t);
    await openPost(page);
    await page.locator("#comment-body").fill("This is my new comment.");
    await page.locator("#submit-comment").click();
    await page.locator("#comment-feedback").waitFor({ state: "visible" });
    assert.match(await page.locator("#comment-feedback").innerText(), /Comment posted/i);
    assert.match(await page.locator("#comments-list").innerText(), /my new comment/);
    const created = calls.find((call) => call.method === "POST" && call.pathname === "/comments/add");
    assert.equal(created?.body.postId, 1);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#comments-list").getByText("This is my new comment.").waitFor();
});

// Both update methods are part of the assignment.
test("PATCH and PUT: editing title/body persists after reloading", async (t) => {
    const { page, calls } = await newPage(t);
    await openPost(page);

    for (const [method, title] of [["PATCH", "Updated with PATCH"], ["PUT", "Updated with PUT"]]) {
        await page.locator("#edit-post").click();
        await page.locator("#edit-title").fill(title);
        await page.locator("#edit-body").fill(`${method} changed this article body.`);
        await page.locator("#edit-method").selectOption(method);
        await page.locator("#save-post").click();
        await page.locator("#edit-feedback").getByText(/Story updated/i).waitFor();
        assert.equal(await page.locator("#post-title").innerText(), title);
    }

    assert.ok(calls.some((call) => call.method === "PATCH" && call.pathname === "/posts/1"));
    assert.ok(calls.some((call) => call.method === "PUT" && call.pathname === "/posts/1"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#post-title")?.textContent === "Updated with PUT");
    assert.match(await page.locator("#post-content").innerText(), /PUT changed this article body/);
});

// Deletions affect local demo data, not the remote DummyJSON records.
test("DELETE and Reset: a deleted story disappears, then returns after reset", async (t) => {
    const { page, calls } = await newPage(t);
    await openPost(page);
    page.on("dialog", (dialog) => dialog.accept());
    await page.locator("#delete-post").click();
    await page.waitForURL(/\/index\.html#stories$/);
    await page.waitForFunction(() =>
        document.querySelectorAll("#posts-grid .post-card").length === 12,
    );
    assert.match(await page.locator(".card-number").first().innerText(), /002/);
    assert.ok(calls.some((call) => call.method === "DELETE" && call.pathname === "/posts/1"));

    await page.locator("#reset-demo").click();

    // Wait until the reset and article reload have finished.
    await page.waitForFunction(() => {
        const status = document.querySelector("#reset-demo-status");
        const grid = document.querySelector("#posts-grid");

        return (
            status?.textContent?.includes("Demo data reset:") &&
            grid?.getAttribute("aria-busy") === "false" &&
            /^STORY\s*\/\s*001$/.test(
                grid?.querySelector(".card-number")?.textContent?.trim() ?? "",
            )
        );
    });

    // Story 001 should now be restored.
    assert.match(
        await page.locator(".card-number").first().innerText(),
        /001/,
    );

    // Ensure the restored first card is the original story.
    assert.ok(calls.some((call) => call.method === "GET" && call.pathname === "/posts"));
});

// Errors must appear in the UI and allow a retry.
test("GET error: failed homepage request shows feedback and Try again works", async (t) => {
        const { page } = await newPage(t, { failPostsOnce: true });
        await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
        await page.locator("#feed-error").waitFor({ state: "visible" });
        assert.match(await page.locator("#feed-error-message").innerText(), /HTTP 503/);
        await page.locator("#retry-feed").click();
        await page.waitForFunction(() => document.querySelectorAll("#posts-grid .post-card").length === 12);
        assert.equal(await page.locator("#feed-error").isVisible(), false);
    });

    test("POST error: failed comment request is visible and adds nothing", async (t) => {
        const { page } = await newPage(t, { failCommentPost: true });
        await openPost(page);
        await page.locator("#comment-body").fill("Rejected comment");
        await page.locator("#submit-comment").click();
        await page.locator("#comment-feedback").waitFor({ state: "visible" });
        assert.match(await page.locator("#comment-feedback").innerText(), /Could not post comment.*HTTP 500/i);
        assert.doesNotMatch(await page.locator("#comments-list").innerText(), /Rejected comment/);
    });

    test("PATCH error: failed edit shows feedback and preserves the title", async (t) => {
        const { page } = await newPage(t, { failEdit: true });
        await openPost(page);
        await page.locator("#edit-post").click();
        await page.locator("#edit-title").fill("This must not be saved");
        await page.locator("#save-post").click();
        await page.locator("#edit-feedback").waitFor({ state: "visible" });
        assert.match(await page.locator("#edit-feedback").innerText(), /Could not update story.*HTTP 500/i);
        assert.equal(await page.locator("#post-title").innerText(), POSTS[0].title);
    });

    test("DELETE error: failed deletion leaves the story visible", async (t) => {
        const { page } = await newPage(t, { failDelete: true });
        await openPost(page);
        page.on("dialog", (dialog) => dialog.accept());
        await page.locator("#delete-post").click();
        await page.locator("#delete-feedback").waitFor({ state: "visible" });
        assert.match(await page.locator("#delete-feedback").innerText(), /HTTP 500/);
        assert.equal(await page.locator("#post-title").innerText(), POSTS[0].title);
    });

    test("Invalid detail URL displays a clear error instead of requesting the API", async (t) => {
        const { page, calls } = await newPage(t);
        await page.goto(`${baseUrl}/post.html?id=abc`, { waitUntil: "domcontentloaded" });
        await page.locator("#post-error").waitFor({ state: "visible" });
        assert.match(await page.locator("#post-error-message").innerText(), /invalid story ID/i);
        assert.equal(calls.length, 0);
    });

    test("Mobile: the homepage and article remain usable at 390px width", async (t) => {
        const { page } = await newPage(t);
        await page.setViewportSize({ width: 390, height: 844 });
        await openHome(page);
        assert.equal(await cardCount(page), 12);
        assert.equal(await page.locator("#search").isVisible(), true);
        await openPost(page);
        assert.equal(await page.locator("#comment-body").isVisible(), true);
        assert.equal(await page.locator("#edit-post").isVisible(), true);
    });
