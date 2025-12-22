import { callApi } from "@seam-rpc/client";

export interface User {
    id: string;
    name: string;
}
/**
 * Creates a new user and returns its ID.
 * @param name The name of the user.
 * @returns ID of the newly created user.
 */
export function createUser(name: string): Promise<string> { return callApi("users", "createUser", { name }); }
/**
 * Gets a user by ID.
 * @param id The ID of the user.
 * @returns The user object.
 */
export function getUser(id: string): Promise<User | undefined> { return callApi("users", "getUser", { id }); }
/**
 * Gets the list of all users.
 * @returns Array of users.
 */
export function getUsers(): Promise<User[]> { return callApi("users", "getUsers", {  }); }
/**
 * Uploads a file.
 * @param buffer The file buffer.
 * @returns void.
 */
export function uploadFile(buffer: Buffer): Promise<void> { return callApi("users", "uploadFile", { buffer }); }