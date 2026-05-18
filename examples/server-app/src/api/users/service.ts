import { ApiError } from "@seam-rpc/core";
import { Service } from "../../index.js";

export interface User {
    id: string;
    name: string;
    age: number;
}

export const users: User[] = [];

export const userService = {
    async createUser(name: string, age: number) {
        if (users.find(u => u.name == name)) {
            return { ok: false, error: new ApiError("user_name_already_exists") };
        }

        if (name == "test") {
            return { ok: false, error: new ApiError("invalid_name") };
        }

        const user = {
            id: Date.now().toString(),
            name: name,
            age: age,
        };

        users.push(user);

        return { ok: true, data: user };
    }
} satisfies Service;