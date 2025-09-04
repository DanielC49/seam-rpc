import { getUser } from "./user";

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
 * awdwad
 * @param title 
 * @param content 
 */
export function createPost(authorId: string, title: string, content: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
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
    });
}

export function getPosts(): Promise<Post[]> {
    return new Promise(async (resolve, reject) => {
        resolve(posts);
    });
}