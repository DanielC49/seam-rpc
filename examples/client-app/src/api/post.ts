import { callApi } from "@seam-rpc/client";
interface Post {
    id: string;
    authorId: string;
    title: string;
    content: string;
    likes: number;
}
export function createPost(authorId: string, title: string, content: string): Promise<string> { return callApi("post", "createPost", { authorId, title, content }); }
export function getPosts(): Promise<Post[]> { return callApi("post", "getPosts", {  }); }