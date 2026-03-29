import { SeamContext, seamProcedure } from "@seam-rpc/server";
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
 * Creates a new user and returns its ID.
 * @param name The name of the user.
 * @returns ID of the newly created user.
 */
const createUser = seamProcedure()
    .input({
        name: z.string().default("hello!"),
        age: z.int(),
    })
    .output(outputUser)
    .handler(({ input, ctx }) => {
        console.log("Request path:", ctx.request.originalUrl);
        console.log(ctx.request.headers);

        const user = {
            id: Date.now().toString(),
            name: input.name ?? "",
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
    .output(outputUser.or(z.undefined()))
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
    .handler(({ input }) => {
        // console.log("Uploaded text file from client:", Buffer.from(file.data).toString())
        const buffer = readFileSync("./data/another-file.txt");
        return new File([buffer], "another-file.txt");
    });

export default { createUser, getUser, getUsers, uploadFile };