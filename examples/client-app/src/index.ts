import { setApiUrl } from "@seam-rpc/client";
import * as user from "./api/user";
import * as post from "./api/post";

setApiUrl("http://localhost:3000");

test();

async function test() {
    try {
        const userId = await user.createUser("john");
        console.log("RESULT 1", userId);

        const newUser = await user.getUser(userId);
        console.log("RESULT 2", newUser);

        const users = await user.getUsers();
        console.log("RESULT 3", users);

        const posts = await post.createPost("1", "Test", "Testing posts");
        console.log(posts);
    } catch (err) {
        console.error(err);
    }
}