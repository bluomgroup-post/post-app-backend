import {
  pgTable,
  text,
  serial,
  timestamp,
  pgEnum,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Post category enum — 4 categories as per spec
export const postCategoryEnum = pgEnum("post_category", [
  "yellow",
  "green",
  "red",
  "blue",
]);

// Posts table
export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  // userId placeholder — will be linked to auth later
  userId: text("user_id").notNull().default("anonymous"),
  username: text("username").notNull().default("anonymous"),
  content: text("content"),
  imageUrl: text("image_url"),
  category: postCategoryEnum("category").notNull().default("yellow"),
  likesCount: integer("likes_count").notNull().default(0),
  commentsCount: integer("comments_count").notNull().default(0),
  savesCount: integer("saves_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPostSchema = createInsertSchema(postsTable).omit({
  id: true,
  likesCount: true,
  commentsCount: true,
  savesCount: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;

// Post likes table
export const postLikesTable = pgTable("post_likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPostLikeSchema = createInsertSchema(postLikesTable).omit({ id: true, createdAt: true });
export type InsertPostLike = z.infer<typeof insertPostLikeSchema>;
export type PostLike = typeof postLikesTable.$inferSelect;

// Post comments table
export const postCommentsTable = pgTable("post_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  username: text("username").notNull().default("anonymous"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPostCommentSchema = createInsertSchema(postCommentsTable).omit({ id: true, createdAt: true });
export type InsertPostComment = z.infer<typeof insertPostCommentSchema>;
export type PostComment = typeof postCommentsTable.$inferSelect;

// Post saves table
export const postSavesTable = pgTable("post_saves", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPostSaveSchema = createInsertSchema(postSavesTable).omit({ id: true, createdAt: true });
export type InsertPostSave = z.infer<typeof insertPostSaveSchema>;
export type PostSave = typeof postSavesTable.$inferSelect;
