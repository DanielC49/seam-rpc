# SeamRPC

## About
SeamRPC is a simple RPC library for client-server communication using TypeScript using Express for the server.

Making requests to the server is as simple as calling a function and SeamRPC sends it to server for you under the hood.

## Setup
### Server
Implement your API functions in a TypeScript file. It's recommended to split different routes into different files, all inside the same folder. You can also optionally include JSDoc comments for the functions.

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
/**
 * Interfaces and types
 * You can define interfaces and types (need to be exported)
 */

export interface User {
    id: string;
    name: string;
}

const users: User[] = [];

/**
 * Functions
 * Define your functions like usual TypeScript functions (need to be exported)
 */

/**
 * Creates a new user and returns its ID.
 * @param name The name of the user.
 * @returns ID of the newly created user.
 */
export function createUser(name: string): Promise<string> {
    return new Promise(resolve => {
        const user = {
            id: Date.now().toString(),
            name
        };
        users.push(user);
        resolve(user.id);
    });
}

/**
 * Gets a user by ID.
 * @param id The ID of the user.
 * @returns The user object.
 */
export function getUser(id: string): Promise<User | undefined> {
    return new Promise((resolve, reject) => {
        const user = users.find(e => e.id == id);
        if (user)
            resolve(user);
        else
            reject("user not found");
    });
}
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

The generated `api/users.ts` file:
> Notice that the JSDoc comments are included in the client files.
```ts
import { callApi } from "@seam-rpc/client";

export interface User {
    id: string;
    name: string;
}

/**
 * Creates a new user and returns its ID.
 * @param name The name of the user.
 * @returns ID of the newly created user.
 */
export function createUser(name: string): Promise<string> { return callApi("users", "createUser", { name }); }
/**
 * Gets a user by ID.
 * @param id The ID of the user.
 * @returns The user object.
 */
export function getUser(id: string): Promise<User | undefined> { return callApi("users", "getUser", { id }); }
/**
 * Gets the list of all users.
 * @returns Array of users.
 */
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