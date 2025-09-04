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
    return new Promise((resolve) => {
        resolve(users.find(e => e.id == id));
    });
}

export function getUsers(): Promise<User[]> {
    return new Promise((resolve) => {
        resolve(users);
    });
}