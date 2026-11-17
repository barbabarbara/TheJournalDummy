# The Journal — Interactive Blog Platform

**The Journal** is a responsive blog built with **HTML, CSS, and vanilla JavaScript** for the DummyJSON REST API assignment. Visitors can browse articles, read comments, add comments, edit posts, and delete posts. Search, tag filtering, and sorting support the higher-grade (VG) requirements.

The website runs as a **static site**: no frontend framework, backend server, API key, or image-generation service is required. Node.js is used only to run the automated tests.

## Features

- **Explore stories:** Load all available posts from DummyJSON and display **12 posts per page**, with page navigation.
- **Find stories:** Search posts, filter by their original DummyJSON tags, and sort by ID, title, views, or likes.
- **Read an article:** Open a dedicated URL such as `post.html?id=3` to read the full post and its comments.
- **Comment:** Submit a comment through the API; show it after a successful response.
- **Edit:** Update a post's title, body, and tags with **PATCH or PUT**.
- **Delete:** Remove a post from the local demo after a successful **DELETE** request.
- **Reset demo data:** Clear locally stored edits, deletions, and comments to return to the original API content.
- **Responsive design:** Layouts for desktop, tablet, and mobile, with loading, empty, and error states.

### Images and design

The homepage uses two **local WebP images**: `editorial-magazine.webp` in the hero and `empty_book.webp` in the featured-story area. Individual article pages use a grey CSS illustration; the All Stories cards are text-only. No image-search or AI-image API is called.

## Run locally

1. Open the project folder in **VS Code**.
2. Start **Live Server** from `index.html` (or use another local static HTTP server).
3. In the browser, open the homepage and click any article to view its detail page.

> Use an HTTP address such as `http://127.0.0.1:5500/`, not a `file://` URL. The website needs internet access to reach DummyJSON.

**Main pages:** `index.html` is the homepage; `post.html?id=3` is an example article detail URL. The query-string URL works on GitHub Pages without server-side routing.

## REST API operations

All API calls are centralized in `assets/js/services/api.js` and use `fetch()`.

| Method | DummyJSON endpoint | Purpose |
| --- | --- | --- |
| GET | `/posts?limit=0` | Fetch the posts for the homepage |
| GET | `/posts/:id` | Fetch one article |
| GET | `/comments/post/:id?limit=0` | Fetch that article's comments |
| POST | `/comments/add` | Submit a comment |
| PATCH / PUT | `/posts/:id` | Update an article |
| DELETE | `/posts/:id` | Delete an article |

The API service checks `response.ok`, handles network errors and invalid JSON, and throws meaningful errors. The page modules display failures in the interface, including retry controls or form feedback where appropriate.

### How demo changes are saved

**DummyJSON simulates POST, PATCH, PUT, and DELETE requests; it does not permanently change its server data.** After the API reports success, The Journal stores the corresponding change in the browser's `localStorage`.

- Changes survive a refresh **in the same browser**.
- **Reset demo data / Reset to default** removes locally saved post edits, deletions, and comments. It does not modify the DummyJSON server.
- **Clear filters** only resets search, tag filtering, and sorting; it does **not** erase saved changes.
- Changes are **not shared** between devices, browsers, or visitors. This is a demonstration, not a multi-user database.

## Project structure

```text
TheJournalDummy/
├── index.html
├── post.html
├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── icons/
│   │   └── favicon.svg
│   ├── images/
│   │   ├── editorial-magazine.webp
│   │   └── empty_book.webp
│   └── js/
│       ├── pages/
│       │   ├── app.js          # Homepage, search, filters, sorting, pagination
│       │   └── post.js         # Article details, comments, edit, delete
│       ├── services/
│       │   └── api.js          # All REST API requests
│       └── shared/
│           ├── storage.js      # Browser-local changes and reset
│           ├── utils.js        # Shared text helpers
│           └── validators.js   # Input validation
├── tests/
│   ├── api.test.mjs       # REST methods, responses and errors
│   ├── browser.test.mjs   # Playwright: real browser workflows
│   ├── storage.test.mjs   # Local persistence and reset
│   ├── structure.test.mjs # HTML and project structure
│   └── utils.test.mjs     # Helpers and validation
├── .fallowrc.json         # Fallow analyzer configuration
├── .gitignore
├── package.json           # npm scripts and Playwright dependency
├── package-lock.json      # Reproducible npm dependencies
├── README.md
└── TASK.md
```

The `node_modules/` and `.fallow/` folders are generated locally and excluded from Git. Keep `package-lock.json` committed so the test dependencies can be installed consistently. `.fallowrc.json` configures the optional Fallow analyzer; none of these files are needed by GitHub Pages.

## Tests

Automated tests are run from the **project root**, the folder containing `package.json`. Node.js is **only required for testing**; visitors do not need Node.js to use the site.

### 1. Unit tests (fast)

The four unit-test files cover API requests, `response.ok` and error handling, validation, storage/reset, utilities, and expected HTML structure. Their API requests are mocked; no live DummyJSON connection is required.

```bash
npm test
```

This runs `api.test.mjs`, `storage.test.mjs`, `structure.test.mjs`, and `utils.test.mjs`. It does **not** start a browser.

### 2. Browser tests (Playwright)

`tests/browser.test.mjs` contains **12 browser tests** that exercise the user interface. They cover:

- Showing 12 stories and navigating between pages.
- Searching, filtering by tag, sorting, and clearing filters.
- Opening an article and loading its comments.
- Posting a comment after a successful POST and retaining it after refresh.
- Editing with PATCH and PUT, including persistence.
- Deleting an article and restoring it with Reset demo data.
- Visible GET, POST, PATCH, and DELETE error messages.
- Invalid article URLs and a 390px mobile viewport.

The browser suite starts its **own local HTTP server** and intercepts DummyJSON requests with test data. **You do not need to start Live Server**, and the tests do not change real API data.

**First-time setup:** install Node.js (a current LTS release is recommended), then run these commands from the project root:

```bash
npm ci
npx playwright install chromium
```

`npm ci` installs the development dependencies declared in `package.json` and locked in `package-lock.json`. Playwright's browser download is a separate setup step.

**Run browser tests:**

```bash
npm run test:browser
```

**Run both suites:**

```bash
npm test
npm run test:browser
```

Your `package.json` defines separate commands so the fast Node tests and browser tests do not run together unintentionally:

```json
"scripts": {
  "test": "node --test tests/api.test.mjs tests/storage.test.mjs tests/structure.test.mjs tests/utils.test.mjs",
  "test:browser": "node --test tests/browser.test.mjs"
}
```

If a browser test fails, inspect the **first error and its locator**. For example, a timeout waiting for `#post-footer` can mean the article script threw an error during rendering. Check the article page and browser console; increasing the timeout alone will not fix a JavaScript error.

### 3. Manual verification

Before submission, also check the live website in Chrome at desktop, tablet, and mobile sizes. Run through the GET → POST → PATCH/PUT → DELETE → Reset sequence, verify errors in the UI, and confirm links work on GitHub Pages. Mocked automated tests do not prove the public API or deployed site is currently reachable.

## Assignment requirements

| Requirement | How to demonstrate |
| --- | --- |
| **G — GET 10+ posts** | Homepage shows 12 posts per page |
| **G — Dedicated post page** | Open `post.html?id=3` or click any story |
| **G — Comments (GET)** | Read the comments on an article page |
| **G — Add comment (POST)** | Write and submit a comment |
| **G — Edit post (PATCH/PUT)** | Edit the title and body, then save |
| **G — Delete post (DELETE)** | Delete a story after confirmation |
| **G — Error handling** | Check visible API and form error messages |
| **G — Responsive UI** | Test different viewport sizes |
| **VG — Search** | Search stories on the homepage |
| **VG — Filter** | Select an article tag |
| **VG — Sort** | Sort by views, likes, title, or ID |

## Deploy to GitHub Pages

1. Push `index.html`, `post.html`, `assets/`, and the supporting project files to a GitHub repository.
2. Open **Settings → Pages** in the repository.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose `main` and `/(root)`, then save.
5. Open the URL provided by GitHub and test an article link such as `post.html?id=3`.

**Submit both URLs:** the GitHub repository URL and the live GitHub Pages URL.

## Suggested demonstration

Open the homepage and search for **forest**. Clear the filters, sort by **Most viewed**, and try a tag. Open a story, show its comments, add a comment, edit the title or body, and refresh to demonstrate local persistence. Delete the article, then use **Reset demo data** to restore the original view.

---

*The Journal is an educational demo using the public DummyJSON API, not a production publishing platform.*
