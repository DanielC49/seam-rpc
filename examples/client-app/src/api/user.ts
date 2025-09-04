import { callApi } from "@seam-rpc/client";
export interface User {
    id: string;
    name: string;
}
export function getUser(id: string): Promise<User | undefined> { return callApi("user", "getUser", { id }); }
export function createUser(name: string): Promise<string> { return callApi("user", "createUser", { name }); }
export function getUsers(): Promise<User[]> { return callApi("user", "getUsers", {  }); }