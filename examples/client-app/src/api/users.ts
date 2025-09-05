import { callApi } from "@seam-rpc/client";

export interface User {
    id: string;
    name: string;
}

export function createUser(name: string): Promise<string> { return callApi("users", "createUser", { name }); }

export function getUser(id: string): Promise<User | undefined> { return callApi("users", "getUser", { id }); }

export function getUsers(): Promise<User[]> { return callApi("users", "getUsers", {  }); }
/**
 * Upload a file.
 * @param buffer 
 * @returns 
 */
export function uploadFile(buffer: Buffer): Promise<void> { return callApi("users", "uploadFile", { buffer }); }