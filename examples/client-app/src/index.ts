import { createSeamClient } from "@seam-rpc/client";
import { ApiRoutersType } from "./types/api.js";

const client = createSeamClient<ApiRoutersType>("http://localhost:3000");
const api = client.api;

const res = await api.users.createUser({ name: "john", age: 25 });
if (res.ok) {
    console.log(res.data);
} else {
    console.log(res.error);
}

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

// async function test() {
//     try {
//         const res = await createUser({ name: "John", age: 25 });
//         if (res.ok) {
//             console.log("Created user:", res.data);
//         } else {
//             console.log("Failed to create user: " + res.error.code);
//         }

//         // const createdUser = await user.getUser({ id: newUser.id });
//         // console.log("Created user data:", createdUser);

//         // const users = await user.getUsers();
//         // console.log("All users:", users);

//         // const postId = await post.createPost({ authorId: newUser.id, title: "Test", content: "Testing posts" });
//         // console.log("Created post with ID:", postId);

//         // const posts = await post.getPosts();
//         // console.log("All posts:", posts);

//         // const file = await user.uploadFile({ file: new File(["Hello from client!"], "test.txt") });
//         // console.log("Downloaded text file from server:", await file.text());
//     } catch (err) {
//         console.error(err);
//     }
// }

// test();

// export type ErrorMap = {
//     user_name_already_exists: undefined,
// };