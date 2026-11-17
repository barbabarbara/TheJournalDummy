
/* ========== THE JOURNAL — HOMEPAGE ========== */

/**
 * Homepage responsibilities:
 * 1. Fetch articles from DummyJSON.
 * 2. Apply locally saved article changes.
 * 3. Display the featured article and article cards.
 * 4. Handle search, tag filtering, and sorting.
 * 5. Handle pagination and direct page navigation.
 * 6. Manage loading, empty, and error states.
 *
 * The HTML and CSS design remain unchanged.
 */

/* ========== 01. IMPORTS ========== */

import { fetchPosts } from "../services/api.js";
import { applySavedPosts, resetDemoData } from "../shared/storage.js";
import { truncateText } from "../shared/utils.js";

/* ========== 02. DOM ELEMENTS ========== */

// Article containers.
const postsGrid = document.querySelector("#posts-grid");
const featuredPost = document.querySelector("#featured-post");
const resultCount = document.querySelector("#result-count");

// Search, filter, and sorting controls.
const searchInput = document.querySelector("#search");
const tagFilter = document.querySelector("#tag-filter");
const sortSelect = document.querySelector("#sort");
const filtersForm = document.querySelector("#filters");

// Pagination controls.
const pagination = document.querySelector("#pagination");
const prevPageButton = document.querySelector("#prev-page");
const nextPageButton = document.querySelector("#next-page");
const pageInfo = document.querySelector("#page-info");
const pageNumbers = document.querySelector("#page-numbers");
const pageJumpForm = document.querySelector("#page-jump-form");
const pageJumpInput = document.querySelector("#page-jump-input");

// Loading, error, and empty-state elements.
const errorBox = document.querySelector("#feed-error");
const errorMessage = document.querySelector("#feed-error-message");
const retryButton = document.querySelector("#retry-feed");
const emptyState = document.querySelector("#empty-state");
const resetDemoButton = document.querySelector("#reset-demo");
const resetDemoStatus = document.querySelector("#reset-demo-status");

/* ========== 03. CONSTANTS AND STATE ========== */

const PAGE_SIZE = 12;
const MAX_EXCERPT_LENGTH = 175;
const FEATURED_EXCERPT_LENGTH = 240;

// Default order: 001, 002, 003 ... 251.
const DEFAULT_SORT = "id-asc";

// All articles retrieved from the API.
let allPosts = [];

// Articles after search, filtering, and sorting.
let visiblePosts = [];

// Currently displayed page.
let currentPage = 1;

/* ========== 04. SORTING OPTIONS ========== */

/**
 * Each comparator defines how two articles are ordered.
 *
 * A negative result puts article a before article b.
 * A positive result puts article b before article a.
 */
const sorters = {
  "id-asc": (a, b) => a.id - b.id,

  "id-desc": (a, b) => b.id - a.id,

  "views-desc": (a, b) =>
    (b.views ?? 0) - (a.views ?? 0),

  "likes-desc": (a, b) =>
    (b.reactions?.likes ?? 0) -
    (a.reactions?.likes ?? 0),

  "title-asc": (a, b) =>
    String(a.title ?? "").localeCompare(
      String(b.title ?? ""),
    ),
};

/**
 * Ensure the sorting dropdown supports ascending IDs.
 *
 * This also works with the previous version of index.html,
 * where the ascending option might not yet exist.
 */
function initializeSorting() {
  if (!sortSelect) return;

  const hasAscendingOption = Array.from(
    sortSelect.options,
  ).some((option) => option.value === DEFAULT_SORT);

  if (!hasAscendingOption) {
    const option = new Option(
      "Post ID: lowest first",
      DEFAULT_SORT,
    );

    sortSelect.insertBefore(
      option,
      sortSelect.firstChild,
    );
  }

  sortSelect.value = DEFAULT_SORT;
}

/* ========== 06. FEATURED ARTICLE ========== */

/**
 * Display the most-viewed article in the
 * existing featured story section.
 *
 * @param {Array<Object>} posts
 */
function renderFeaturedStory(posts) {
  if (!featuredPost) return;

  if (posts.length === 0) {
    featuredPost.hidden = true;
    return;
  }

  featuredPost.hidden = false;

  // Select the article with the most views.
  const featured = [...posts].sort(
    (a, b) => (b.views ?? 0) - (a.views ?? 0),
  )[0];

  const content = featuredPost.querySelector(
    ".featured-content",
  );

  if (!content) return;

  // Featured category heading.
  const kicker = content.querySelector(
    ".featured-kicker",
  );

  if (kicker) {
    kicker.textContent =
      "EDITOR’S PICK · FEATURED STORY";
  }

  // Featured tags.
  const tagList = content.querySelector(".tag-list");

  if (tagList) {
    const tagElements = (featured.tags ?? [])
      .slice(0, 3)
      .map((tag) => {
        const element = document.createElement(
          "span",
        );

        element.className = "tag";
        element.textContent = tag;

        return element;
      });

    tagList.replaceChildren(...tagElements);
  }

  // Featured title and article link.
  const title = content.querySelector(
    ".featured-title",
  );

  if (title) {
    const link = document.createElement("a");

    link.href = `./post.html?id=${featured.id}`;
    link.textContent = featured.title;

    title.replaceChildren(link);
  }

  // Featured article preview.
  const description = content.querySelector(
    ".featured-description",
  );

  if (description) {
    description.textContent = truncateText(
      featured.body ?? "",
      FEATURED_EXCERPT_LENGTH,
    );
  }

  // Featured metadata.
  const meta = content.querySelector(
    ".featured-meta",
  );

  if (meta) {
    const views = featured.views ?? 0;
    const likes = featured.reactions?.likes ?? 0;

    meta.textContent =
      `${views} views · ${likes} likes`;
  }

}

/* ========== 07. CREATE ARTICLE CARDS ========== */

/**
 * Create a complete article card using
 * data returned by DummyJSON.
 *
 * @param {Object} post
 * @returns {HTMLElement}
 */
function createPostCard(post) {
  // Outer article element.
  const article = document.createElement("article");

  article.className = "post-card";

  /* ----- Card header ----- */

  const cardTop = document.createElement("div");

  cardTop.className = "card-top";

  // Example: STORY / 001.
  const cardNumber = document.createElement("span");

  cardNumber.className = "card-number";

  cardNumber.textContent =
    `STORY / ${String(post.id).padStart(3, "0")}`;

  const cardArrow = document.createElement("span");

  cardArrow.className = "card-arrow";
  cardArrow.textContent = "↗";
  cardArrow.setAttribute("aria-hidden", "true");

  cardTop.append(cardNumber, cardArrow);

  /* ----- Card main content ----- */

  const cardMain = document.createElement("div");

  cardMain.className = "card-main";

  // Tags.
  const tagList = document.createElement("div");

  tagList.className = "tag-list";

  for (const tag of (post.tags ?? []).slice(0, 3)) {
    const tagElement = document.createElement("span");

    tagElement.className = "tag";
    tagElement.textContent = tag;

    tagList.append(tagElement);
  }

  // Article title and link.
  const titleLink = document.createElement("a");

  titleLink.className = "card-title-link";
  titleLink.href = `./post.html?id=${post.id}`;

  const title = document.createElement("h3");

  title.className = "card-title";
  title.textContent = post.title;

  titleLink.append(title);

  // Article excerpt.
  const excerpt = document.createElement("p");

  excerpt.className = "card-excerpt";

  excerpt.textContent = truncateText(
    post.body ?? "",
    MAX_EXCERPT_LENGTH,
  );

  cardMain.append(
    tagList,
    titleLink,
    excerpt,
  );

  /* ----- Card metadata ----- */

  const cardMeta = document.createElement("div");

  cardMeta.className = "card-meta";

  const views = document.createElement("span");

  views.textContent =
    `◉ ${post.views ?? 0} views`;

  const likes = document.createElement("span");

  likes.textContent =
    `♥ ${post.reactions?.likes ?? 0} likes`;

  cardMeta.append(views, likes);

  /* ----- Card actions ----- */

  const cardActions = document.createElement("div");

  cardActions.className = "card-actions";

  const readLink = document.createElement("a");

  readLink.className = "card-read";
  readLink.href = `./post.html?id=${post.id}`;
  readLink.textContent = "Read story ↗";

  cardActions.append(readLink);

  /* ----- Assemble the card ----- */

  article.append(
    cardTop,
    cardMain,
    cardMeta,
    cardActions,
  );

  return article;
}

/* ========== 08. PAGINATION ========== */

/**
 * Return the number of pages required
 * for the currently visible articles.
 *
 * @returns {number}
 */
function getTotalPages() {
  return Math.ceil(
    visiblePosts.length / PAGE_SIZE,
  );
}

/**
 * Navigate to a valid page.
 *
 * @param {number} page
 */
function goToPage(page) {
  const totalPages = getTotalPages();

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > totalPages
  ) {
    return;
  }

  currentPage = page;

  renderPosts();

  resultCount?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

/**
 * Create numbered pagination buttons.
 *
 * Example:
 * 1 2 3 ... 10 ... 28
 *
 * @param {number} totalPages
 */
function renderPageNumbers(totalPages) {
  if (!pageNumbers) return;

  if (totalPages <= 1) {
    pageNumbers.replaceChildren();
    return;
  }

  // Always include the first and last pages.
  const pages = new Set([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);

  const sortedPages = [...pages]
    .filter(
      (page) => page >= 1 && page <= totalPages,
    )
    .sort((a, b) => a - b);

  const fragment = document.createDocumentFragment();

  /**
   * Create one clickable page-number button.
   */
  function addPageButton(page) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "page-number";
    button.textContent = String(page);

    button.setAttribute(
      "aria-label",
      `Go to page ${page}`,
    );

    if (page === currentPage) {
      button.classList.add("active");

      button.setAttribute(
        "aria-current",
        "page",
      );
    }

    button.addEventListener("click", () => {
      goToPage(page);
    });

    fragment.append(button);
  }

  /**
   * Add ellipses between distant page numbers.
   */
  function addEllipsis() {
    const dots = document.createElement("span");

    dots.className = "page-ellipsis";
    dots.textContent = "…";

    dots.setAttribute(
      "aria-hidden",
      "true",
    );

    fragment.append(dots);
  }

  let previousPage = 0;

  for (const page of sortedPages) {
    const gap = page - previousPage;

    if (previousPage !== 0) {
      if (gap === 2) {
        // Display the single missing page.
        addPageButton(previousPage + 1);
      } else if (gap > 2) {
        // Display ellipses for a larger gap.
        addEllipsis();
      }
    }

    addPageButton(page);

    previousPage = page;
  }

  pageNumbers.replaceChildren(fragment);
}

/* ========== 09. TAG FILTER ========== */

/**
 * Populate the tag dropdown from API articles.
 *
 * @param {Array<Object>} posts
 */
function populateTagOptions(posts) {
  if (!tagFilter) return;

  const previousValue = tagFilter.value;

  // Extract unique tags and sort alphabetically.
  const tags = [
    ...new Set(
      posts.flatMap((post) => post.tags ?? []),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const options = [
    new Option("All tags", ""),
  ];

  for (const tag of tags) {
    options.push(new Option(tag, tag));
  }

  tagFilter.replaceChildren(...options);

  // Preserve the selected tag when possible.
  tagFilter.value = tags.includes(previousValue)
    ? previousValue
    : "";
}

/* ========== 10. SEARCH, FILTER AND SORT ========== */

/**
 * Filter articles using the user's search and tag.
 * Then sort the results and return to page 1.
 */
function applyFilters() {
  const search = (
    searchInput?.value ?? ""
  )
    .trim()
    .toLocaleLowerCase();

  const tag = tagFilter?.value ?? "";

  // Keep only articles matching the criteria.
  visiblePosts = allPosts.filter((post) => {
    const searchableParts = [
      post.title,
      post.body,
      ...(post.tags ?? []),
    ];

    const matchesSearch =
      !search ||
      searchableParts.some((part) =>
        String(part ?? "")
          .toLocaleLowerCase()
          .includes(search),
      );

    const matchesTag =
      !tag || post.tags?.includes(tag);

    return matchesSearch && matchesTag;
  });

  // Apply the selected sorting method.
  const selectedSort = sortSelect?.value ?? DEFAULT_SORT;

  const comparator =
    sorters[selectedSort] ?? sorters[DEFAULT_SORT];

  visiblePosts.sort(comparator);

  // Start from page 1 after changing filters.
  currentPage = 1;

  renderPosts();
}

/* ========== 11. RENDER ARTICLES ========== */

/**
 * Display the current page of matching articles.
 */
function renderPosts() {
  const totalPages = getTotalPages();

  // Ensure currentPage remains valid.
  if (totalPages === 0) {
    currentPage = 1;
  } else {
    currentPage = Math.min(
      Math.max(currentPage, 1),
      totalPages,
    );
  }

  // Calculate the starting array index.
  const startIndex =
    (currentPage - 1) * PAGE_SIZE;

  // Select twelve articles for the current page.
  const currentPosts = visiblePosts.slice(
    startIndex,
    startIndex + PAGE_SIZE,
  );

  // Build cards in memory before updating the DOM.
  const fragment = document.createDocumentFragment();

  for (const post of currentPosts) {
    fragment.append(createPostCard(post));
  }

  // Replace the previously displayed cards.
  postsGrid.replaceChildren(fragment);

  // Display the empty state if necessary.
  if (emptyState) {
    emptyState.hidden = visiblePosts.length > 0;
  }

  /* ----- Result count ----- */

  if (resultCount) {
    if (visiblePosts.length === 0) {
      resultCount.textContent =
        "No matching stories.";
    } else {
      const first = startIndex + 1;
      const last = startIndex + currentPosts.length;

      resultCount.textContent =
        `Showing ${first}–${last} of ` +
        `${visiblePosts.length} stories.`;
    }
  }

  /* ----- Pagination ----- */

  if (pageInfo) {
    pageInfo.textContent =
      `Page ${currentPage} of ${Math.max(1, totalPages)}`;
  }

  renderPageNumbers(totalPages);

  // Update the direct page-jump input.
  if (pageJumpInput) {
    pageJumpInput.min = "1";
    pageJumpInput.max = String(
      Math.max(1, totalPages),
    );
    pageJumpInput.value = String(currentPage);
  }

  if (prevPageButton) {
    prevPageButton.disabled = currentPage <= 1;
  }

  if (nextPageButton) {
    nextPageButton.disabled =
      currentPage >= totalPages;
  }

  // Hide pagination when unnecessary.
  if (pagination) {
    pagination.hidden = totalPages <= 1;
  }
}

/* ========== 12. LOAD ARTICLES ========== */

/**
 * Fetch all articles and display the homepage.
 *
 * Handles loading, success, failure, and retries.
 */
async function loadPosts() {
  // Avoid starting duplicate requests.
  if (
    postsGrid?.getAttribute("aria-busy") === "true"
  ) {
    return;
  }

  /* ----- Loading state ----- */

  if (errorBox) {
    errorBox.hidden = true;
  }

  if (emptyState) {
    emptyState.hidden = true;
  }

  if (pagination) {
    pagination.hidden = true;
  }

  postsGrid.setAttribute("aria-busy", "true");

  if (resultCount) {
    resultCount.textContent = "Loading stories…";
  }

  if (retryButton) {
    retryButton.disabled = true;
  }

  try {
    /* ----- Fetch articles ----- */

    const posts = await fetchPosts();

    // Apply edits and deletions saved in localStorage.
    allPosts = applySavedPosts(posts);

    // Populate available tags.
    populateTagOptions(allPosts);

    // Display the featured article.
    renderFeaturedStory(allPosts);

    // Apply the current search, filter, and sort.
    applyFilters();
  } catch (error) {
    /* ----- Handle errors ----- */

    console.error(
      "Failed to load articles:",
      error,
    );

    allPosts = [];
    visiblePosts = [];
    renderFeaturedStory([]);

    postsGrid.replaceChildren();

    if (errorMessage) {
      errorMessage.textContent =
        `Unable to load stories: ${error.message} Please try again.`;
    }

    if (errorBox) {
      errorBox.hidden = false;
    }

    if (emptyState) {
      emptyState.hidden = true;
    }

    if (pagination) {
      pagination.hidden = true;
    }

    if (resultCount) {
      resultCount.textContent =
        "Could not load stories.";
    }
  } finally {
    /* ----- Always execute ----- */

    postsGrid.setAttribute(
      "aria-busy",
      "false",
    );

    if (retryButton) {
      retryButton.disabled = false;
    }
  }
}

/* ========== 13. EVENT LISTENERS ========== */

/* ----- Search ----- */

searchInput?.addEventListener(
  "input",
  applyFilters,
);

/* ----- Tag filtering ----- */

tagFilter?.addEventListener(
  "change",
  applyFilters,
);

/* ----- Sorting ----- */

sortSelect?.addEventListener(
  "change",
  applyFilters,
);

/* ----- Reset filters ----- */

filtersForm?.addEventListener("reset", () => {
  // The browser resets form inputs after this event.
  // Run filtering once the reset has completed.
  queueMicrotask(() => {
    if (sortSelect) {
      sortSelect.value = DEFAULT_SORT;
    }

    applyFilters();
  });
});

/* ----- Previous page ----- */

prevPageButton?.addEventListener(
  "click",
  () => {
    goToPage(currentPage - 1);
  },
);

/* ----- Next page ----- */

nextPageButton?.addEventListener(
  "click",
  () => {
    goToPage(currentPage + 1);
  },
);

/* ----- Direct page navigation ----- */

pageJumpForm?.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();

    if (!pageJumpInput) return;

    // Validate the entered page number.
    if (!pageJumpInput.checkValidity()) {
      pageJumpInput.reportValidity();
      return;
    }

    const page = Number(pageJumpInput.value);

    goToPage(page);
  },
);

/* ----- Reset local demonstration changes ----- */

resetDemoButton?.addEventListener("click", async () => {
  if (!window.confirm(
    "Reset all locally edited/deleted stories and posted comments? " +
    "This cannot be undone.",
  )) return;

  const success = resetDemoData();
  if (!success) {
    resetDemoStatus.textContent =
      "Could not clear your browser data. Check browser storage settings.";
    return;
  }

  resetDemoStatus.textContent =
    "Demo changes cleared. Loading the original stories…";
  await loadPosts();
  if (errorBox?.hidden) {
    resetDemoStatus.textContent =
      "Demo data reset: original stories and comments restored.";
  }
});

/* ----- Retry failed API request ----- */

retryButton?.addEventListener(
  "click",
  loadPosts,
);

/* ========== 14. INITIALIZATION ========== */

/**
 * Prepare the homepage and load the articles.
 */
function initializeHomepage() {
  if (!postsGrid) {
    console.error(
      "The article grid (#posts-grid) was not found.",
    );
    return;
  }

  // Set the correct initial order: 001 to 251.
  initializeSorting();

  // Fetch and display the articles.
  void loadPosts();
}

// Start the homepage.
initializeHomepage();
