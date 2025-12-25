import { getUser, User } from "./users";

export interface Post {
    id: string;
    author: User;
    title: string;
    content: string;
}

const posts: Post[] = [];

/**
 * Creates a post and returns its ID.
 * @param title The title of the post.
 * @param content The conent of the post.
 * @returns ID of the newly created post.
 */
export async function createPost(authorId: string, title: string, content: string): Promise<string> {
    const author = await getUser(authorId);

    if (author === undefined)
        return Promise.reject();

    const post: Post = {
        id: Date.now().toString(),
        author,
        title,
        content,
    };

    posts.push(post);
    return post.id;
}

/**
 * Gets the list of all posts.
 * @returns Array of posts.
 */
export async function getPosts(): Promise<Post[]> {
    return posts;
}