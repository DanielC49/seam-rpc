import express from "express";
import { createSeamSpace, Result, ApiError } from "@seam-rpc/server";
import { usersRouter } from "./api/users/procedures.js";

const app = express();
const seamSpace = await createSeamSpace(app);

const apiRouters = seamSpace.addRouters({
    users: usersRouter
});

export type ApiRoutersType = typeof apiRouters;

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

export interface Service {
    [funcName: string]: (...args: any[]) => Promise<Result<unknown, ApiError<ErrorMap>>>;
}

type ErrorMap = {
    user_name_already_exists: undefined,
    invalid_name: undefined,
};