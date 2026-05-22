import { Result } from "@seam-rpc/server";
import { ApiError } from "@seam-rpc/core";
declare const apiRouters: {
    users: {
        createUser: (input: {
            name: string;
            age: number;
        }) => Promise<{
            ok: true;
            data: {
                id: string;
                name: string;
                age: number;
            };
        } | {
            ok: false;
            error: ApiError<{
                user_name_already_exists: any;
            }, "user_name_already_exists">;
        } | {
            ok: false;
            error: ApiError<{
                invalid_name: any;
            }, "invalid_name">;
        }>;
    };
};
export type ApiRoutersType = typeof apiRouters;
export interface Service {
    [funcName: string]: (...args: any[]) => Promise<Result<unknown, ApiError<ErrorMap>>>;
}
type ErrorMap = {
    user_name_already_exists: undefined;
    invalid_name: undefined;
};
export {};
