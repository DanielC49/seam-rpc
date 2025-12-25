import { SeamFile, setApiUrl } from "@seam-rpc/client";
import { readFileSync } from "fs";
import * as user from "./api/users";
import * as post from "./api/posts";

setApiUrl("http://localhost:3000");

test();

async function test() {
    try {
        const userId = await user.createUser("john");
        console.log("Created user with ID:", userId);

        const newUser = await user.getUser(userId);
        console.log("Created user data:", newUser);

        const users = await user.getUsers();
        console.log("All users:", users);

        const postId = await post.createPost(userId, "Test", "Testing posts");
        console.log("Created post with ID:", postId);

        const posts = await post.getPosts();
        console.log("All posts:", posts);

        const file = await user.uploadFile(new SeamFile(readFileSync("./data/test.txt")));
        console.log("Downloaded text file from server:", Buffer.from(file.data).toString());
    } catch (err) {
        console.error(err);
    }
}