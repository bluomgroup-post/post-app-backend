// Posts routes — Feature 3: Posts (Home Feed)
// Handles: create post, list posts, like/unlike, comment, save/unsave

import { Router, type IRouter } from "express";
import { eq, desc, and, count } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  postsTable,
  postLikesTable,
  postCommentsTable,
  postSavesTable,
} from "@workspace/db";
import {
  ListPostsResponse,
  CreatePostBody,
  GetPostResponse,
  ListPostsQueryParams,
  AddCommentBody,
  ToggleLikeBody,
  ToggleSaveBody,
  AddCommentResponse,
  ListCommentsResponse,
  ToggleLikeResponse,
  ToggleSaveResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /posts — list all posts, optionally filtered by category
router.get("/posts", async (req, res): Promise<void> => {
  const query = ListPostsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { category, limit, offset } = query.data;

  const conditions = category
    ? [eq(postsTable.category, category)]
    : [];

  const posts = await db
    .select()
    .from(postsTable)
    .where(conditions.length > 0 ? conditions[0] : undefined)
    .orderBy(desc(postsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(postsTable)
    .where(conditions.length > 0 ? conditions[0] : undefined);

  req.log.info({ count: posts.length }, "Listed posts");
  res.json(ListPostsResponse.parse({ posts, total }));
});

// POST /posts — create a new post (text or photo)
router.post("/posts", async (req, res): Promise<void> => {
  const body = CreatePostBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { username, content, imageUrl, category } = body.data;

  // Must have either text content or an image
  if (!content && !imageUrl) {
    res.status(400).json({ error: "Post must have text or an image" });
    return;
  }

  const [post] = await db
    .insert(postsTable)
    .values({
      username,
      content: content ?? null,
      imageUrl: imageUrl ?? null,
      category: category ?? "yellow",
    })
    .returning();

  req.log.info({ postId: post.id }, "Post created");
  res.status(201).json(GetPostResponse.parse(post));
});

// GET /posts/:id — get a single post
router.get("/posts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid post id" });
    return;
  }

  const [post] = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, id));

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.json(GetPostResponse.parse(post));
});

// DELETE /posts/:id — delete a post
router.delete("/posts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid post id" });
    return;
  }

  const [deleted] = await db
    .delete(postsTable)
    .where(eq(postsTable.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  req.log.info({ postId: id }, "Post deleted");
  res.sendStatus(204);
});

// POST /posts/:id/like — toggle like on a post
router.post("/posts/:id/like", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const postId = parseInt(raw, 10);
  if (isNaN(postId)) {
    res.status(400).json({ error: "Invalid post id" });
    return;
  }

  const body = ToggleLikeBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { userId } = body.data;

  // Check if already liked
  const [existing] = await db
    .select()
    .from(postLikesTable)
    .where(
      and(
        eq(postLikesTable.postId, postId),
        eq(postLikesTable.userId, userId)
      )
    );

  let liked: boolean;

  if (existing) {
    // Unlike — remove the like
    await db
      .delete(postLikesTable)
      .where(
        and(
          eq(postLikesTable.postId, postId),
          eq(postLikesTable.userId, userId)
        )
      );
    const [current] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
    await db
      .update(postsTable)
      .set({ likesCount: Math.max(0, current.likesCount - 1) })
      .where(eq(postsTable.id, postId));
    liked = false;
  } else {
    // Like — add the like
    await db.insert(postLikesTable).values({ postId, userId });
    const [current] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
    await db
      .update(postsTable)
      .set({ likesCount: current.likesCount + 1 })
      .where(eq(postsTable.id, postId));
    liked = true;
  }

  const [updated] = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, postId));

  res.json(ToggleLikeResponse.parse({ liked, likesCount: updated.likesCount }));
});

// POST /posts/:id/save — toggle save on a post
router.post("/posts/:id/save", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const postId = parseInt(raw, 10);
  if (isNaN(postId)) {
    res.status(400).json({ error: "Invalid post id" });
    return;
  }

  const body = ToggleSaveBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { userId } = body.data;

  const [existing] = await db
    .select()
    .from(postSavesTable)
    .where(
      and(
        eq(postSavesTable.postId, postId),
        eq(postSavesTable.userId, userId)
      )
    );

  let saved: boolean;

  if (existing) {
    await db
      .delete(postSavesTable)
      .where(
        and(
          eq(postSavesTable.postId, postId),
          eq(postSavesTable.userId, userId)
        )
      );
    const [current] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
    await db
      .update(postsTable)
      .set({ savesCount: Math.max(0, current.savesCount - 1) })
      .where(eq(postsTable.id, postId));
    saved = false;
  } else {
    await db.insert(postSavesTable).values({ postId, userId });
    const [current] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
    await db
      .update(postsTable)
      .set({ savesCount: current.savesCount + 1 })
      .where(eq(postsTable.id, postId));
    saved = true;
  }

  const [updated] = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, postId));

  res.json(ToggleSaveResponse.parse({ saved, savesCount: updated.savesCount }));
});

// GET /posts/:id/comments — get all comments on a post
router.get("/posts/:id/comments", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const postId = parseInt(raw, 10);
  if (isNaN(postId)) {
    res.status(400).json({ error: "Invalid post id" });
    return;
  }

  const comments = await db
    .select()
    .from(postCommentsTable)
    .where(eq(postCommentsTable.postId, postId))
    .orderBy(desc(postCommentsTable.createdAt));

  res.json(ListCommentsResponse.parse({ comments }));
});

// POST /posts/:id/comments — add a comment to a post
router.post("/posts/:id/comments", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const postId = parseInt(raw, 10);
  if (isNaN(postId)) {
    res.status(400).json({ error: "Invalid post id" });
    return;
  }

  const body = AddCommentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { userId, username, content } = body.data;

  if (!content) {
    res.status(400).json({ error: "Comment cannot be empty" });
    return;
  }

  const [post] = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, postId));

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const [comment] = await db
    .insert(postCommentsTable)
    .values({ postId, userId, username, content })
    .returning();

  // Increment comment count
  await db
    .update(postsTable)
    .set({ commentsCount: post.commentsCount + 1 })
    .where(eq(postsTable.id, postId));

  req.log.info({ postId, commentId: comment.id }, "Comment added");
  res.status(201).json(AddCommentResponse.parse(comment));
});

export default router;
