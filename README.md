<img width="1940" height="829" alt="image" src="https://github.com/user-attachments/assets/8a4a8a8b-1b57-4c1e-b6bb-ebab81ba8a32" />

# SeamRPC

## About
SeamRPC is a simple RPC library for client-server communication using TypeScript using Express for the server.

Making requests to the server is as simple as calling a function and SeamRPC sends it to server for you under the hood.

## Setup
### Server
Implement your API functions in a TypeScript file. It's recommended to split different routes into different files, all inside the same folder. You can also optionally include JSDoc comments for the functions. The returned value of an API function is sent from the server to the client. If an error is thrown in the API function in the server, the function throws an error in the client as well (Seam RPC internally responds with HTTP code 400 which the client interprets as an error).

> **Note:** For consistency reasons between server and client API functions, Seam RPC requires all API functions to return a Promise.

**Example:**
```
server-app
  ├─ index.ts
  └─ api
     ├─ users.ts
     └─ posts.ts
```

`api/users.ts`
```ts
import { SeamFile } from "@seam-rpc/server";

export interface User {
    id: string;
    name: string;
}

const users: User[] = [];

/**
 * Creates a new user and returns its ID.
 * @param name The name of the user.
 * @returns ID of the newly created user.
 */
export async function createUser(name: string): Promise<string> {
    const user = {
        id: Date.now().toString(),
        name
    };
    users.push(user);
    return user.id;
}

/**
 * Gets a user by ID.
 * @param id The ID of the user.
 * @returns The user object.
 */
export async function getUser(id: string): Promise<User | undefined> {
    const user = users.find(e => e.id == id);
    if (user)
        return user;
    else
        throw new Error("user not found");
}
```

#### Create a Seam Space

A Seam Space is linked to an app in Express to which you define routers to. You define one for your API, which can then be separated in to different routers. Each router can be any kind of structure with functions (e.g. an object or a module). This example uses files.

```ts
import express from "express";
import { createSeamSpace } from "@seam-rpc/server";

// Import as modules
import * as usersRouter from "./api/users.js";
import * as postsRouter from "./api/posts.js";

// Create express app
const app = express();

// Create Seam Space with express app
const seamSpace = await createSeamSpace(app);

// Create routers
seamSpace.createRouter("/users", usersRouter);
seamSpace.createRouter("/posts", postsRouter);

// Start express server
app.listen(3000, () => {
    console.log("Listening on port 3000");
});
```

### Client
The client needs to have the same schema as your API so you can call the API functions and have autocomplete. Behind the scenes these functions will send an HTTP requests to the server. SeamRPC can automatically generate the client schema files. To do this, you can either run the command `seam-rpc gen-client <input-files> <output-folder>` or [define a config file](#config-file) and then run the command `seam-rpc gen-client`.

- `input-files` - Specify what files to generate the client files from. You can use [glob pattern](https://en.wikipedia.org/wiki/Glob_(programming)) to specify the files.
- `output-folder` - Specify the folder where to store the generated client api files.

**Example:**
`seam-rpc gen-client ./src/api/* ../server-app/src/api`

```
client-app
  ├─ index.ts
  └─ api
     ├─ users.ts
     └─ posts.ts
```
The api folder in the client contains the generated API client files, and should not be manually edited.

The generated `api/users.ts` file:
> Notice that the JSDoc comments are included in the client files.
```ts
import { callApi, SeamFile, ISeamFile } from "@seam-rpc/client";
export interface User {
    id: string;
    name: string;
}
/**
 * Creates a new user and returns its ID.
 * @param name The name of the user.
 * @returns ID of the newly created user.
 */
export function createUser(name: string): Promise<string> { return callApi("users", "createUser", [name]); }
/**
 * Gets a user by ID.
 * @param id The ID of the user.
 * @returns The user object.
 */
export function getUser(id: string): Promise<User | undefined> { return callApi("users", "getUser", [id]); }
```

#### Connect client to server
To establish the connection from the client to the server, you need to specify which URL to call. This example is using a self-hosted server running on port 3000 so it uses `http://localhost:3000`. Just call `setApiUrl` to set the URL.

```ts
setApiUrl("http://localhost:3000");
```

### Config file
If you don't want to specify the input files and output folder every time you want to generate the client files, you can create a config file where you define these paths. You can create a `seam-rpc.config.json` file at the root of your project and use the following data:
```json
{
    "inputFiles": "./src/api/*",
    "outputFolder": "../client/src/api"
}
```
or you can automatically generate a file using `seam-rpc gen-config [input-files] [output-folder]`. If you don't specify the input files and output folder, it will use the default paths (see JSON above).

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

## Important notices
- The generated client files contain all imports from the api implementation file in the backend that import from the current relative folder (`./`). This is the simplest way I have to include imports (at least for now). It may import functions and unused symbols but that shouldn't be too worrying.
- Don't include backend/server functions inside the server api files.
- Only exported functions will be included in the client generated files.

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

> **Note:** The above example is to illustrate the use of error handlers is not a complete example. Please consult the rest of the README or the examples in the examples directory.