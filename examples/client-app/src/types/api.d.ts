import { Result } from "@seam-rpc/server";
import { ApiError } from "@seam-rpc/core";
declare const apiRouters: {
    users: {
        createUser: (input: {
            name: string;
            age: number;
        }) => Promise<Result<{
            id: string;
            name: string;
            age: number;
        }, any>>;
    };
};
export type ApiRoutersType = typeof apiRouters;
export interface Service {
    [funcName: string]: (...args: any[]) => Promise<Result<unknown, ApiError<ErrorMap>>>;
}
type ErrorMap = {
    user_name_already_exists: undefined;
};
export {};
