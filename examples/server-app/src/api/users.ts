import { SeamFile } from "@seam-rpc/server";
import { readFileSync, writeFileSync } from "fs";

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
export function createUser(name: string): Promise<string> {
    return new Promise(resolve => {
        const user = {
            id: Date.now().toString(),
            name
        };
        users.push(user);
        resolve(user.id);
    });
}

/**
 * Gets a user by ID.
 * @param id The ID of the user.
 * @returns The user object.
 */
export function getUser(id: string): Promise<User | undefined> {
    return new Promise((resolve, reject) => {
        const user = users.find(e => e.id == id);
        if (user)
            resolve(user);
        else
            reject("user not found");
    });
}

/**
 * Gets the list of all users.
 * @returns Array of users.
 */
export function getUsers(): Promise<User[]> {
    return new Promise((resolve) => {
        resolve(users);
    });
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