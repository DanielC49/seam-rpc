import { Result, ApiError } from "@seam-rpc/server";
declare const apiRouters: import("@seam-rpc/server").RouterToClient<{
    users: {
        createUser: import("@seam-rpc/server").ProcedureBuilder<{
            name: import("zod").ZodString;
            age: import("zod").ZodInt;
            createdAt: import("zod").ZodDate;
        }, import("zod").ZodObject<{
            id: import("zod").ZodString;
            name: import("zod").ZodString;
            age: import("zod").ZodInt;
            createdAt: import("zod").ZodDate;
        }, import("zod/v4/core").$strip>, {
            user_name_already_exists: {
                name: string;
            };
            invalid_name: {
                reason: string;
            };
        }>;
    };
}>;
export type ApiRoutersType = typeof apiRouters;
export interface Service {
    [funcName: string]: (...args: any[]) => Promise<Result<unknown, ApiError<ErrorMap, keyof ErrorMap>>>;
}
type ErrorMap = {
    user_name_already_exists: {
        name: string;
    };
    invalid_name: {
        reason: string;
    };
    another_error: undefined;
};
export {};
