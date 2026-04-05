import { seamProcedure } from "@seam-rpc/server";
import { getUser, outputUser, users } from "./users.js";
import type { User } from "./users.js";
import z from "zod";

export interface Post {
    id: string;
    author: User;
    title: string;
    content: string;
}

const outputPost = z.object({
    id: z.string(),
    author: outputUser,
    title: z.string(),
    content: z.string(),
});

const posts: Post[] = [];

/**
 * Creates a post and returns its ID.
 * @param title The title of the post.
 * @param content The conent of the post.
 * @returns ID of the newly created post.
 */
const createPost = seamProcedure()
    .input({
        authorId: z.string(),
        title: z.string().max(100),
        content: z.string().max(500),
    })
    .output(z.string())
    .handler(({ input }) => {
        const author = users.find(e => e.id == input.authorId);

        if (author === undefined)
            return Promise.reject();

        const post: Post = {
            id: Date.now().toString(),
            author,
            title: input.title,
            content: input.content,
        };

        posts.push(post);
        return post.id;
    });

/**
 * Gets the list of all posts.
 * @returns Array of posts.
 */
const getPosts = seamProcedure()
    .output(z.array(outputPost))
    .handler(() => {
        return posts;
    });

export default { createPost, getPosts };