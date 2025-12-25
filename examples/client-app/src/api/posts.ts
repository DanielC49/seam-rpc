import { callApi, SeamFile, ISeamFile } from "@seam-rpc/client";
import { getUser, User } from "./users";
interface Post {
    id: string;
    author: User;
    title: string;
    content: string;
}
/**
 * Creates a post and returns its ID.
 * @param title The title of the post.
 * @param content The conent of the post.
 * @returns ID of the newly created post.
 */
export function createPost(authorId: string, title: string, content: string): Promise<string> { return callApi("posts", "createPost", [authorId, title, content]); }
/**
 * Gets the list of all posts.
 * @returns Array of posts.
 */
export function getPosts(): Promise<Post[]> { return callApi("posts", "getPosts", []); }