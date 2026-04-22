import { extractFiles, injectFiles, ResError, RpcError, type Result } from "@seam-rpc/core";

export { RpcError };
export type { Result };

export type SeamRequestMiddleware = (context: SeamRequestMiddlewareContext) => void | Promise<void>;
export type SeamResponseMiddleware = (context: SeamResponseMiddlewareContext) => void | Promise<void>;

export interface SeamRequestMiddlewareContext {
    request: RequestInit;
    routerName: string;
    funcName: string;
    input?: Record<string, any>;
}

export type SeamResponseMiddlewareContext = SeamRequestMiddlewareContext & {
    response: Response;
    parsedResponse: any;
}

export interface SeamClientOptions {
    middleware?: {
        request?: SeamRequestMiddleware[];
        response?: SeamResponseMiddleware[];
    }
}

export class SeamClient {
    static _instance: SeamClient;

    public options: SeamClientOptions;

    constructor(public readonly baseUrl: string, options?: SeamClientOptions) {
        SeamClient._instance = this;
        this.options = {
            middleware: {
                request: options?.middleware?.request || [],
                response: options?.middleware?.response || [],
            }
        }
    }

    preRequest(middleware: SeamRequestMiddleware) {
        this.options?.middleware?.request?.push(middleware);
    }

    postRequest(middleware: SeamResponseMiddleware) {
        this.options?.middleware?.response?.push(middleware);
    }
}

export class SeamError extends RpcError {
    constructor(code: string) {
        super(code, undefined);
    }
}

type SeamClientErrorType =
    | "REQUEST_FAILED"
    | "TIMEOUT"
    | "PARSE_ERROR"
    | "INVALID_RESPONSE";

export class SeamClientError extends Error {
    constructor(
        readonly type: SeamClientErrorType,
        message: string,
        readonly request: RequestInit,
        readonly cause: unknown
    ) {
        super(message);
        this.name = "SeamClientError";
    }
}

export function createSeamClient(baseUrl: string, options?: SeamClientOptions): SeamClient {
    return new SeamClient(baseUrl, options);
}

export async function callApi(routerName: string, funcName: string, input?: Record<string, any>): Promise<Result<any, any>> {
    if (!SeamClient._instance)
        throw new Error("Seam Client not instantiated.");

    const seamClient = SeamClient._instance;

    const req = buildRequest(input);
    const url = `${seamClient.baseUrl}/${routerName}/${funcName}`;

    if (seamClient.options?.middleware?.request) {
        for (const mw of seamClient.options.middleware.request) {
            await mw({
                request: req,
                routerName,
                funcName,
                input,
            });
        }
    }

    let res: Response;

    try {
        res = await fetch(url, req);
    } catch (err) {
        throw new SeamClientError("REQUEST_FAILED", "Failed to send request.", req, err);
    }

    if (!res.ok) {
        if (res.status == 400) {
            const resError: ResError = await res.json();
            if (resError.rpcError) {
                return {
                    ok: false,
                    error: new RpcError(resError.error.code, resError.error.data),
                }
            } else {
                return { ok: false, error: null };
            }
        }
        // throw new Error(`Request failed at router ${routerName} at function ${funcName}, with status ${res.status} ${res.statusText}.`);
        return { ok: false, error: null };
    }

    const contentType = res.headers.get("content-type") || "";

    if (contentType.startsWith("application/json")) {
        const data = await res.json();
        return {
            ok: true,
            data: data.result,
        };
    } else if (contentType.startsWith("multipart/form-data")) {
        const formData = await res.formData();
        const jsonPart = JSON.parse(formData.get("json")?.toString() || "[]");
        const pathsPart: (string | number)[][] = JSON.parse(formData.get("paths")?.toString() || "[]");

        const responseFiles: { path: (string | number)[]; file: File }[] = [];

        for (const [key, value] of formData.entries()) {
            if (key.startsWith("file-")) {
                const index = parseInt(key.replace("file-", ""));
                const blob = value as Blob;
                responseFiles.push({
                    path: pathsPart[index],
                    file: new File([blob], (blob as any).name),
                });
            }
        }

        injectFiles(jsonPart, responseFiles);

        if (seamClient.options?.middleware?.response) {
            for (const mw of seamClient.options.middleware.response) {
                await mw({
                    request: req,
                    response: res,
                    parsedResponse: jsonPart.result,
                    routerName,
                    funcName,
                    input,
                });
            }
        }

        return {
            ok: true,
            data: jsonPart.result,
        };
    } else {
        return { ok: false, error: null };
    }
}

function buildRequest(input: Record<string, any> = {}): RequestInit {
    let req: RequestInit;

    const { json, files, paths } = extractFiles(input);

    if (files.length > 0) {
        const formData = new FormData();

        formData.append("json", JSON.stringify(json));
        formData.append("paths", JSON.stringify(paths));

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            formData.append(`file-${i}`, file, file.name || `file-${i}`);
        }

        req = {
            method: "POST",
            body: formData,
        };
    } else {
        req = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(input),
        };
    }

    return req;
}