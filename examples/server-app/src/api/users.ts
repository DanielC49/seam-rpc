export interface User {
    id: string;
    name: string;
}

const users: User[] = [];

export function createUser(name: string): Promise<string> {
    return new Promise((resolve) => {
        const user = {
            id: Date.now().toString(),
            name
        };
        users.push(user);
        resolve(user.id);
    });
}

export function getUser(id: string): Promise<User | undefined> {
    return new Promise((resolve, reject) => {
        const user = users.find(e => e.id == id);
        if (user)
            resolve(user);
        else
            reject("user not found");
    });
}

export function getUsers(): Promise<User[]> {
    return new Promise((resolve) => {
        resolve(users);
    });
}

/**
 * Upload a file.
 * @param buffer 
 * @returns 
 */
export function uploadFile(buffer: Buffer): Promise<void> {
    return new Promise((resolve) => {
        resolve();
    });
}