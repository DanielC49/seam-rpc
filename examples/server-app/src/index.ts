import express from "express";
import { createRouter } from "@seam-rpc/server";

import * as usersRouter from "./api/users";
import * as postsRouter from "./api/posts";

const app = express();

app.use(express.json());

createRouter(app, "/users", usersRouter);
createRouter(app, "/posts", postsRouter);

app.listen(3000, () => {
    console.log("Listening on port 3000");
});