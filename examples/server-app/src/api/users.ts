import { seamProcedure } from "@seam-rpc/server";
import { readFileSync } from "fs";
import z from "zod";

export interface User {
    id: string;
    name: string;
    age: number;
}

export const outputUser = z.object({
    id: z.string(),
    name: z.string(),
    age: z.int(),
});

export const users: User[] = [];

/**
 * Creates a new user and returns it.
 * @param name The name of the user.
 * @param age The age of the user.
 * @returns The newly created user.
 */
const createUser = seamProcedure()
    .input({
        name: z.string().min(3).max(200),
        age: z.int().min(1).max(150),
    })
    .output(outputUser)
    .errors({
        user_name_already_exists: z.object({ name: z.string() }),
    })
    .handler(({ input, ctx, error }) => {
        console.log("Request path:", ctx.request.originalUrl);
        console.log(ctx.request.headers);

        if (users.find(u => u.name == input.name)) {
            throw error("user_name_already_exists", { name: input.name });
        }

        const user = {
            id: Date.now().toString(),
            name: input.name,
            age: input.age,
        };

        users.push(user);

        return user;
    });

/**
 * Gets a user by ID.
 * @param id The ID of the user.
 * @returns The user object.
 */
export const getUser = seamProcedure()
    .input({ id: z.string() })
    .output(outputUser)
    .handler(({ input }) => {
        const user = users.find(e => e.id == input.id);
        if (user)
            return user;
        else
            throw new Error("user not found");
    });

/**
 * Gets the list of all users.
 * @returns Array of users.
 */
const getUsers = seamProcedure()
    .output(z.array(outputUser))
    .handler(({ input }) => {
        return users;
    });

/**
 * Uploads a file.
 * @param buffer The file buffer.
 * @returns void.
 */
const uploadFile = seamProcedure()
    .input({
        file: z.file(),
    })
    .output(z.file())
    .handler(async ({ input }) => {
        console.log("Uploaded text file from client:", await input.file.text())
        const buffer = readFileSync("./data/another-file.txt");
        return new File([buffer], "another-file.txt");
    });

export default { createUser, getUser, getUsers, uploadFile };