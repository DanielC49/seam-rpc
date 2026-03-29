import express from "express";
import { createSeamSpace } from "@seam-rpc/server";

// Import procedure definitions
import usersRouter from "./api/users.js";
import postsRouter from "./api/posts.js";

const app = express();
const seamSpace = await createSeamSpace(app);

seamSpace.createRouter("/users").addProcedures(usersRouter);
seamSpace.createRouter("/posts").addProcedures(postsRouter);

// Handle errors

seamSpace.on("validationError", (error, context) => {
    console.error(`Data Validation Error at ${context.procedureName}!`, error);
});

seamSpace.on("apiError", (error, context) => {
    console.error(`API Error at ${context.procedureName}!`, error);
});

seamSpace.on("internalError", (error, context) => {
    console.error(`Internal Error at ${context.procedureName}!`, error);
});


// Start express server
app.listen(3000, () => {
    console.log("Listening on port 3000");
});