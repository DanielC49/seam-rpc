import express from "express";
import { createSeamSpace } from "@seam-rpc/server";

// Import procedure definitions
import usersRouter, { outputUser } from "./api/users.js";
import postsRouter from "./api/posts.js";

const app = express();
const seamSpace = await createSeamSpace(app);

seamSpace.createRouter("/users").addProcedures(usersRouter);
seamSpace.createRouter("/posts").addProcedures(postsRouter);

// Handle errors

seamSpace.on("inputValidationError", (error, context) => {
    console.error(`Input Validation Error at ${context.procedureName}\n`, error);
});

seamSpace.on("outputValidationError", (error, context) => {
    console.error(`Output Validation Error at ${context.procedureName}\n`, error);
});

seamSpace.on("apiError", (error, context) => {
    console.error(`API Error at ${context.procedureName}\n`, error);
});

seamSpace.on("internalError", (error, context) => {
    console.error(`Internal Error at ${context.procedureName}\n`, error);
});


// Start express server
app.listen(3000, () => {
    console.log("Listening on port 3000");
});