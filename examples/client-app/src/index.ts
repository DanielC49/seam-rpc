import { createSeamClient } from "@seam-rpc/client";
import * as user from "./api/users.js";
import * as post from "./api/posts.js";

const client = createSeamClient("http://localhost:3000");

client.preRequest(ctx => {
    // Add a custom header before sending the request
    ctx.request.headers = {
        ...ctx.request.headers,
        "X-MyHeader": "Test"
    };
});

client.postRequest(ctx => {
    // Get value of a custom header from server response
    console.log(ctx.response.headers.get("X-SomeHeader"));
});

test();

async function test() {
    try {
        const newUser = await user.createUser({ name: "John", age: 25 });
        console.log("Created user:", newUser);

        const createdUser = await user.getUser({ id: newUser.id });
        console.log("Created user data:", createdUser);

        const users = await user.getUsers();
        console.log("All users:", users);

        const postId = await post.createPost({ authorId: newUser.id, title: "Test", content: "Testing posts" });
        console.log("Created post with ID:", postId);

        const posts = await post.getPosts();
        console.log("All posts:", posts);

        const file = await user.uploadFile({ file: new File(["Hello from client!"], "test.txt") });
        console.log("Downloaded text file from server:", await file.text());
    } catch (err) {
        console.error(err);
    }
}