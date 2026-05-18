<img width="1940" height="829" alt="image" src="https://github.com/user-attachments/assets/8a4a8a8b-1b57-4c1e-b6bb-ebab81ba8a32" />

# About
SeamRPC is a simple RPC library for client-server communication using TypeScript and an Express server.

Making requests to the server is as simple as calling a function and SeamRPC sends it to server for you under the hood.

# Quick start
This guide will help you build a simple server and client with users and posts to demonstrate how to use the most essential features of SeamRPC. Check the rest of the documentation for more details and information regarding all of the features SeamRPC has to offer.

## Server
Each function/endpoint is called a procedure. It can accept input and can return output. You can group procedures in to different routes.

> **Note:** For consistency reasons between server and client API procedures, Seam RPC requires all API functions to return a Promise.

### Define API router procedures
Implement your API procedures in a TypeScript file.

`api/users.ts`
```ts
import { seamProcedure } from "@seam-rpc/server";
import z from "zod";
import { ApiError } from "@seam-rpc/core";
import { Service } from "../../index.js";

export interface User {
    id: string;
    name: string;
    age: number;
}

export const users: User[] = [];

export const outputUser = z.object({
    id: z.string(),
    name: z.string(),
    age: z.int(),
});

export const usersRouter = {
    createUser: seamProcedure()
        .input({
            name: z.string().min(3).max(200),
            age: z.int().min(1).max(150),
        })
        .output(outputUser)
        .handler(async ({ input }) => {
            if (users.find(u => u.name == name)) {
                return { ok: false, error: new ApiError("user_name_already_exists") };
            }

            const user = {
                id: Date.now().toString(),
                name: name,
                age: age,
            };

            users.push(user);

            return { ok: true, data: user };
        }),
};
```
A procedure's input and output can be validated using the zod library.
> :warning: Make sure you implement proper validation, because without it the client is able to send any kind of data.

### Create a Seam Space

A Seam Space is linked to an Express app and is what you defined routers to. You define one Seam Space for your API, which can then be separated in to different routers. Each router can be any kind of structure with functions (e.g. an object or a module). This example uses files as modules.

```ts
import express from "express";
import { createSeamSpace } from "@seam-rpc/server";
import { usersRouter } from "./api/users/procedures.js";

const app = express();
const seamSpace = await createSeamSpace(app);

const apiRouters = seamSpace.addRouters({
    users: usersRouter,
});

// Export API type to use in client
export type ApiRoutersType = typeof apiRouters;

// Start express server
app.listen(3000, () => {
    console.log("Listening on port 3000");
});
```

## Client
The client needs to have the same schema as your API so you can call the API functions and have autocomplete. Behind the scenes these functions will send HTTP requests to the server. You can generate a declaration file (`.d.ts`) and copy it to the client. For example, you could create an npm script like so:

**Example:**
```json
"scripts": {
    "gc": "tsc && copy .\\dist\\index.d.ts ..\\client-app\\src\\types\\api.d.ts"
},
```

When you run `npm run gc` it will compily the project and copy the api type from `index.d.ts` to `api.d.ts` in the client.

#### Connect client to server
To establish the connection from the client to the server, you need to specify which URL to call. This example is using a self-hosted server running on port 3000 so it uses `http://localhost:3000`. Just call `createSeamClient` and pass the API type and url to create a client.

```ts
import { createSeamClient } from "@seam-rpc/client";
import { ApiRoutersType } from "./types/api.js";

const client = createSeamClient<ApiRoutersType>("http://localhost:3000");
const api = client.api;

const res = await api.users.createUser({name: "john", age: 25});
console.log(res);
```

## Uploading and downloading files
Both server and client can send files seamlessly. Just use the SeamFile class for this. You can have a parameter as a file or an array/object containing a file. You can have deeply nested files inside objects.

A SeamFile has 3 properties:
- `data` - binary data
- `fileName` (optional) - name of the file
- `mimeType` (optional) - The MIME type of the file ([Learn more](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/MIME_types))


**Example:**
```ts
interface UserData {
    id: string;
    name: string;
    avatar: SeamFile;
}

export async function updateUser(userId: string, userData: UserData): Promise<void> {
    if (userData.avatar.mimeType != "image/png" && userData.avatar.mimeType != "image/jpeg")
        throw new Error("Only PNGs and JPEGs allowed for avatar.");

    users[userId].name = userData.name;
    users[userId].avatar = userData.avatar.fileName;
    writeFileSync(`../avatars/${userData.avatar.fileName}`, userData.avatar.data);
}
```

## Supported types
SeamRPC supports the following types (at least for now):
- `string`
- `number`
- `boolean`
- `null`
- `undefined`
- arrays
- objects

Classes are technically supported, in that the data is serialized to JSON.

Other JavaScript types are not supported, although SeamRPC doesn't prevent you from using them, in which case they might lead to unexpected beahviour or even errors.

The Date object type is not supported (at least for now). However, you can use `number` and pass `Date.now()` or `string` and pass `new Date().toString()`. This is not different than a normal HTTP request using JSON. SeamRPC also uses JSON behind the scenes, that's why there's these limitations, which could be overcome but I've decided not to because it would probably add more overhead to the logic.

## Context parameter

### Server
If you want, you can get access to the request, response and next function from Express. Just add a parameter of type SeamContext at the end of the API function. You can name the parameter whatever you like. This parameter is optional. This parameter is not included in the client generated files.

Example:
```ts
export async function createUser(name: string, context: SeamContext): Promise<string> {
    // Using the context to read the request path.
    console.log("Request path:", context.request.originalUrl);

    const user = {
        id: Date.now().toString(),
        name
    };
    users.push(user);
    return user.id;
}
```

### Client
The client currently doesn't support access to the response object from the fetch.

## Error handling

### Server
To catch errors across router functions in the server, you can use the `apiError` and `internalError` events.
- `apiError` - Error ocurred when calling or during execution of your API function.
- `internalError` - SeamRPC internal error. Please report if you find an error that seems like a bug or requires improvement.

Example:
```ts
const seamSpace = await createSeamSpace(app);

seamSpace.on("apiError", (error, context) => {
    console.error(`API Error at ${context.functionName}!`, error);
});

seamSpace.on("internalError", (error, context) => {
    console.error(`Internal Error at ${context.functionName}!`, error);
});
```

> **Note:** The above example is to illustrate the use of error handlers and is not a complete example. Please consult the rest of the README or the examples in the examples directory.

## Middleware

### Client
You can add middleware functions in the client. There's two types:
- Pre-request - Before the request is sent. You might for example want to add some header to the request.
- Post-request - After the request was sent. You might for example want to read some header from reponse.

There's two ways to add middleware, either when creating the client:
```ts
createClient("http://localhost:3000", {
    middleware: {
        request: [
            ctx => {
                ctx.request.headers = {
                    ...ctx.request.headers,
                    "X-MyHeader": "Test"
                };
            },
        ],
        response: [
            ctx => {
                console.log(ctx.response.headers.get("X-SomeHeader"));
            }
        ]
    }
});
```
... or after creating the client:
```ts
const client = createClient("http://localhost:3000");

client.preRequest(ctx => {
    ctx.request.headers = {
        ...ctx.request.headers,
        "X-MyHeader": "Test"
    };
});

client.postRequest(ctx => {
    console.log(ctx.response.headers.get("X-SomeHeader"));
});
```

> You can add as many middleware functions as you like.