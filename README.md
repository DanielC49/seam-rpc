# SeamRPC

## About
SeamRPC is a simple RPC library for client-server communication using TypeScript using Express for the server.

Making requests to the server is as simple as calling a function and SeamRPC sends it to server for you under the hood.

## Setup
### Server
Implement your API functions in a TypeScript file. It's recommended to split different routes into different files, all inside the same folder.

**Example:**
```
server-app
  ├─ index.ts
  └─ api
     ├─ users.ts
     └─ posts.ts
```

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

export function getUser(id: string): Promise<User | undefined> {
    return new Promise(resolve => {
        resolve(users.find(e => e.id == id));
    });
}
```

### Client
The client needs to have the same schema as your API but send a request to the server on each function call. SeamRPC makes this process very simple: just call the CLI command `seam-rpc gen-client <input-files> <output-path>`.

- `input-files` - Specify what files to generate the client files from. You can use [glob pattern](https://en.wikipedia.org/wiki/Glob_(programming)) to specify the files.
- `output-folder` - Specify the folder where to store the generated client api files.

Examples:
- `seam-rpc gen-client ./src/api/* ../server-app/src/api`
- `seam-rpc gen-client ./src/api/* ./client/src/api`

```
client-app
  ├─ index.ts
  └─ api
     ├─ users.ts
     └─ posts.ts
```