import { getUser } from "./users";

interface Post {
    id: string;
    authorId: string;
    title: string;
    content: string;
    likes: number;
}

const posts: Post[] = [];

/**
 * Creates a post and returns its ID.
 * @param title The title of the post.
 * @param content The conent of the post.
 * @returns ID of the newly created post.
 */
export function createPost(authorId: string, title: string, content: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
        try {
            const author = await getUser(authorId);

            if (!author)
                reject();

            const post: Post = {
                id: Date.now().toString(),
                authorId,
                title,
                content,
                likes: 0
            };

            posts.push(post);
            resolve(post.id);
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Gets the list of all posts.
 * @returns Array of posts.
 */
export function getPosts(): Promise<Post[]> {
    return new Promise(async (resolve, reject) => {
        resolve(posts);
    });
}