import { callApi } from "@seam-rpc/client";

interface Post {
    id: string;
    authorId: string;
    title: string;
    content: string;
    likes: number;
}
/**
 * Creates a post and returns its ID.
 * @param title The title of the post.
 * @param content The conent of the post.
 * @returns ID of the newly created post.
 */
export function createPost(authorId: string, title: string, content: string): Promise<string> { return callApi("posts", "createPost", { authorId, title, content }); }
/**
 * Gets the list of all posts.
 * @returns Array of posts.
 */
export function getPosts(): Promise<Post[]> { return callApi("posts", "getPosts", {  }); }