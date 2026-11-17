# Assignment — Interactive Blog Platform

Develop an interactive blog platform where users can read, comment on, edit, and delete posts. Build it using **HTML, CSS, and JavaScript** and use `fetch()` with an external REST API.

You must work with **GET, POST, PUT/PATCH, and DELETE** using [DummyJSON](https://dummyjson.com/). Primary resources:

- Posts: https://dummyjson.com/docs/posts
- Comments: https://dummyjson.com/docs/comments

## Pass requirements (G)

- Show at least **10 posts** (GET).
- Each post shows its title, content, and relevant details. **Each post has its own dedicated detail page** (e.g., `/posts/:id`), displaying the post and its comments.
- Users can open a post to read it and its related comments, fetched from the API.
- Users can write a comment on a post. Display it in the UI **after a successful POST** request.
- Users can edit an existing post's **title and body** (PUT/PATCH).
- Users can delete any post (DELETE).
- The site is fully responsive on desktop, tablet, and mobile.

### All API requests must

- Use `try/catch` to handle errors.
- Check `response.ok` for HTTP success.
- Display clear, understandable error messages **in the user interface**, not just in the console.

## Higher-grade requirements (VG)

All G requirements must also be met. Implement:

- Search through posts.
- Filter posts by tags.
- Sort posts by values such as views or reactions.

## Deadline

The assignment must be submitted by the specified deadline to qualify for VG.

## Submission

- GitHub repository URL
- GitHub Pages live-site URL
