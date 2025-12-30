import express from "express";

import * as usersRouter from "./api/users.js";
import * as postsRouter from "./api/posts.js";
import { createSeamSpace } from "@seam-rpc/server";

const app = express();

const seamSpace = await createSeamSpace(app);

seamSpace.createRouter("/users", usersRouter);
seamSpace.createRouter("/posts", postsRouter);

seamSpace.on("apiError", (error, context) => {
    console.error(`API Error at ${context.functionName}!`, error);
});

seamSpace.on("internalError", (error, context) => {
    console.error(`Internal Error at ${context.functionName}!`, error);
});

app.listen(3000, () => {
    console.log("Listening on port 3000");
});