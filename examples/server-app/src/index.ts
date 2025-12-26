import express from "express";

import * as usersRouter from "./api/users.js";
import * as postsRouter from "./api/posts.js";
import { createSeamSpace } from "@seam-rpc/server";

const app = express();

const seamSpace = createSeamSpace(app);

seamSpace.createRouter("/users", usersRouter);
seamSpace.createRouter("/posts", postsRouter);

app.listen(3000, () => {
    console.log("Listening on port 3000");
});