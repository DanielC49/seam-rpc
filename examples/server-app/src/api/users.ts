import { SeamContext, SeamFile } from "@seam-rpc/server";
import { readFileSync } from "fs";

export interface User {
    id: string;
    name: string;
}

const users: User[] = [];

/**
 * Creates a new user and returns its ID.
 * @param name The name of the user.
 * @returns ID of the newly created user.
 */
export async function createUser(name: string, ctx: SeamContext): Promise<string> {
    console.log("Request path:", ctx.request.originalUrl);
    const user = {
        id: Date.now().toString(),
        name
    };
    users.push(user);
    return user.id;
}

/**
 * Gets a user by ID.
 * @param id The ID of the user.
 * @returns The user object.
 */
export async function getUser(id: string): Promise<User | undefined> {
    const user = users.find(e => e.id == id);
    if (user)
        return user;
    else
        throw new Error("user not found");
}

/**
 * Gets the list of all users.
 * @returns Array of users.
 */
export async function getUsers(): Promise<User[]> {
    return users;
}

/**
 * Uploads a file.
 * @param buffer The file buffer.
 * @returns void.
 */
export async function uploadFile(file: SeamFile): Promise<SeamFile> {
    console.log("Uploaded text file from client:", Buffer.from(file.data).toString())
    return new SeamFile(readFileSync("./data/another-file.txt"));
}