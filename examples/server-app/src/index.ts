import express from "express";
import { createRouter } from "@seam-rpc/server";

import * as userRouter from "./api/user";
import * as postRouter from "./api/post";

const app = express();

app.use(express.json());

createRouter(app, "/user", userRouter);
createRouter(app, "/post", postRouter);

app.listen(3000, () => {
    console.log("Listening on port 3000");
});