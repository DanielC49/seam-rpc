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
 * awdwad
 * @param title 
 * @param content 
 */
export function createPost(authorId: string, title: string, content: string): Promise<string> { return callApi("post", "createPost", { authorId, title, content }); }

export function getPosts(): Promise<Post[]> { return callApi("post", "getPosts", {  }); }