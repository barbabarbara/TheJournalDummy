import assert from "node:assert/strict";
import test from "node:test";
import {
  createComment,
  deletePost,
  fetchCommentsByPostId,
  fetchPostById,
  fetchPosts,
  updatePost,
} from "../assets/js/services/api.js";

/**
 * Replace fetch only during one test and restore it afterwards.
 * No real HTTP requests are made by these tests.
 */
async function withMockFetch(handler, callback) {
  const previousFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return handler(url, options);
  };

  try {
    await callback(calls);
  } finally {
    globalThis.fetch = previousFetch;
  }
}

/** Return a successful response with a JSON body. */
function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}

test("GET fetchPosts requests and returns an array of posts", async () => {
  const posts = [{ id: 1, title: "Hello" }];
  await withMockFetch(() => jsonResponse({ posts }), async (calls) => {
    assert.deepEqual(await fetchPosts(), posts);
    assert.equal(calls[0].url, "https://dummyjson.com/posts?limit=0");
  });
});

test("GET fetchPostById requests one post", async () => {
  await withMockFetch(() => jsonResponse({ id: 4 }), async (calls) => {
    assert.equal((await fetchPostById(4)).id, 4);
    assert.equal(calls[0].url, "https://dummyjson.com/posts/4");
  });
});

test("GET fetchCommentsByPostId requests post-specific comments", async () => {
  await withMockFetch(() => jsonResponse({ comments: [] }), async (calls) => {
    assert.deepEqual(await fetchCommentsByPostId(4), []);
    assert.equal(
      calls[0].url,
      "https://dummyjson.com/comments/post/4?limit=0",
    );
  });
});

test("GET rejects unexpected posts and comments response shapes", async () => {
  await withMockFetch(() => jsonResponse({ posts: null }), async () => {
    await assert.rejects(fetchPosts(), /invalid posts array/);
  });
  await withMockFetch(() => jsonResponse({ comments: null }), async () => {
    await assert.rejects(fetchCommentsByPostId(4), /invalid comments array/);
  });
});

test("POST sends normalized comment data and a JSON content type", async () => {
  await withMockFetch(() => jsonResponse({ id: 341 }), async (calls) => {
    assert.equal((await createComment(5, "  Nice post  ")).id, 341);
    assert.equal(calls[0].url, "https://dummyjson.com/comments/add");
    assert.equal(calls[0].options.method, "POST");
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      body: "Nice post",
      postId: 5,
      userId: 1,
    });
    // apiRequest uses a Headers instance rather than a plain object.
    assert.equal(
      calls[0].options.headers.get("Content-Type"),
      "application/json",
    );
  });
});

test("PUT and PATCH update posts with trimmed fields", async () => {
  await withMockFetch(() => jsonResponse({ id: 5 }), async (calls) => {
    await updatePost(5, { title: "  Edited  " }, "PUT");
    await updatePost(5, { body: "  Changed  " }, "PATCH");
    assert.deepEqual(
      calls.map(({ options }) => options.method),
      ["PUT", "PATCH"],
    );
    assert.deepEqual(
      calls.map(({ options }) => JSON.parse(options.body)),
      [{ title: "Edited" }, { body: "Changed" }],
    );
    assert.ok(calls.every(({ options }) => options.headers.get("Content-Type") === "application/json"));
  });
});

test("DELETE sends an HTTP DELETE to the selected post", async () => {
  await withMockFetch(() => jsonResponse({ id: 9, isDeleted: true }), async (calls) => {
    assert.equal((await deletePost(9)).isDeleted, true);
    assert.equal(calls[0].options.method, "DELETE");
    assert.equal(calls[0].url, "https://dummyjson.com/posts/9");
  });
});

test("invalid IDs, comments, and updates are rejected before fetch", async () => {
  await withMockFetch(() => {
    throw new Error("An invalid request should not reach fetch.");
  }, async (calls) => {
    await assert.rejects(fetchPostById(-1), TypeError);
    await assert.rejects(fetchCommentsByPostId(2.5), TypeError);
    await assert.rejects(deletePost("5"), TypeError);
    await assert.rejects(createComment(5, "   "), TypeError);
    await assert.rejects(updatePost(5, { title: "   " }), TypeError);
    await assert.rejects(updatePost(5, { title: "Valid" }, "DELETE"), TypeError);
    assert.equal(calls.length, 0);
  });
});

test("HTTP errors include status and status text", async () => {
  await withMockFetch(
    () => ({ ok: false, status: 404, statusText: "Not Found" }),
    async () => {
      await assert.rejects(fetchPostById(100000), /HTTP 404: Not Found/);
    },
  );
});

test("HTTP errors use a fallback when status text is empty", async () => {
  await withMockFetch(
    () => ({ ok: false, status: 500, statusText: "" }),
    async () => {
      await assert.rejects(fetchPosts(), /HTTP 500: Request failed/);
    },
  );
});

test("network failures are wrapped with an understandable message", async () => {
  const networkError = new TypeError("Failed to fetch");
  await withMockFetch(
    () => { throw networkError; },
    async () => {
      await assert.rejects(fetchPosts(), (error) => {
        assert.match(error.message, /Unable to contact the API server/);
        assert.equal(error.cause, networkError);
        return true;
      });
    },
  );
});

test("invalid JSON responses are reported separately", async () => {
  const parseError = new SyntaxError("Unexpected token");
  await withMockFetch(
    () => ({ ok: true, status: 200, json: async () => { throw parseError; } }),
    async () => {
      await assert.rejects(fetchPosts(), (error) => {
        assert.match(error.message, /The API returned invalid JSON/);
        assert.equal(error.cause, parseError);
        return true;
      });
    },
  );
});

test("HTTP 204 responses return null without attempting JSON parsing", async () => {
  await withMockFetch(
    () => ({ ok: true, status: 204, json: async () => { throw new Error("Must not parse JSON"); } }),
    async () => {
      assert.equal(await deletePost(9), null);
    },
  );
});

test("failed POST, PATCH and DELETE requests report errors", async () => {
  await withMockFetch(
    () => ({ ok: false, status: 503, statusText: "Service Unavailable" }),
    async (calls) => {
      await assert.rejects(createComment(1, "A comment"), /HTTP 503/);
      await assert.rejects(updatePost(1, { title: "Updated" }), /HTTP 503/);
      await assert.rejects(deletePost(1), /HTTP 503/);
      assert.deepEqual(calls.map((call) => call.options.method), ["POST", "PATCH", "DELETE"]);
    },
  );
});

test("PUT/PATCH refuses unsupported methods without making requests", async () => {
  await withMockFetch(
    () => { throw new Error("should not fetch"); },
    async (calls) => {
      await assert.rejects(updatePost(3, { title: "Updated" }, "POST"), /PATCH or PUT/);
      assert.equal(calls.length, 0);
    },
  );
});
