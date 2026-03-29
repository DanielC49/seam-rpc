import { createClient } from "@seam-rpc/client";
import { readFileSync } from "fs";
import * as user from "./api/users.js";
import * as post from "./api/posts.js";

createClient("http://localhost:3000", {
    middleware: {
        request: [
            ctx => {
                ctx.request.headers = {
                    ...ctx.request.headers,
                    "X-MyHeader": "Test"
                };
            },
        ],
        response: [
            ctx => {
                console.log(ctx.response.headers.get("X-SomeHeader"));
            }
        ]
    }
});

test();

async function test() {
    try {
        const newUser = await user.createUser({  age: 25 });
        console.log("Created user:", newUser);

        // const createdUser = await user.getUser({ id: newUser.id });
        // console.log("Created user data:", createdUser);

        // const users = await user.getUsers({});
        // console.log("All users:", users);

        // const postId = await post.createPost({ authorId: newUser.id, title: "Test", content: "Testing posts" });
        // console.log("Created post with ID:", postId);

        // const posts = await post.getPosts({});
        // console.log("All posts:", posts);

        // const file = await user.uploadFile({ file: new File([readFileSync("./data/test.txt")], "test.txt") });
        // console.log(file);
        // console.log("Downloaded text file from server:", await file.text());
    } catch (err) {
        console.error(err);
    }
}