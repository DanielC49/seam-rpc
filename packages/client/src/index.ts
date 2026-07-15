import { extractFiles, injectFiles, extractDates, injectDates, ResError, ApiError, type Result, Ok, Err } from "@seam-rpc/core";

export { ApiError };
export type { Result, Ok, Err };

export type SeamRequestMiddleware = (context: SeamRequestMiddlewareContext) => void | Promise<void>;
export type SeamResponseMiddleware = (context: SeamResponseMiddlewareContext) => void | Promise<void>;
export type SeamOnErrorHandler = (error: SeamClientError) => void | Promise<void>;

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

export interface SeamClientOptionsConstructor {
    middleware?: {
        request?: SeamRequestMiddleware[];
        response?: SeamResponseMiddleware[];
    };
    onError?: SeamOnErrorHandler[];
}

export interface SeamClientOptions {
    middleware: {
        request: SeamRequestMiddleware[];
        response: SeamResponseMiddleware[];
    };
    onError: SeamOnErrorHandler[];
}

export class SeamClient<ApiType> {
    public options: SeamClientOptions;
    public readonly api: ApiType;

    constructor(public readonly baseUrl: string, options?: SeamClientOptionsConstructor) {
        this.options = {
            middleware: {
                request: options?.middleware?.request || [],
                response: options?.middleware?.response || [],
            },
            onError: options?.onError || [],
        };

        const client = this;

        this.api = new Proxy({}, {
            get(_target, routerName) {
                return new Proxy({},
                    {
                        get(_subTarget, procName) {
                            return async (input: any, requestOptions?: RequestInit) => {
                                const url = `${client.baseUrl}/${String(routerName)}/${String(procName)}`;
                                try {
                                    return await callApi(client, url, String(routerName), String(procName), input, requestOptions);
                                } catch (err) {
                                    const error = err instanceof SeamClientError
                                        ? err
                                        : new SeamClientError("UNEXPECTED", "Unexpected error when calling API procedure.", url, null, err);
                                    if (client.options.onError.length == 0) throw error;
                                    for (const handler of client.options?.onError) {
                                        handler(error);
                                    }
                                    return { ok: false, error: new ApiError("") };
                                }
                            }
                        },
                    }
                )
            },
        }) as ApiType;
    }

    preRequest(middleware: SeamRequestMiddleware) {
        this.options?.middleware?.request?.push(middleware);
    }

    postRequest(middleware: SeamResponseMiddleware) {
        this.options?.middleware?.response?.push(middleware);
    }

    onError(handler: SeamOnErrorHandler) {
        this.options.onError?.push(handler);
    }
}

type SeamClientErrorType =
    | "REQUEST_FAILED"
    | "INVALID_CONTENT_TYPE"
    | "UNEXPECTED"
    ;

export class SeamClientError extends Error {
    constructor(
        readonly type: SeamClientErrorType,
        message: string,
        readonly url: string,
        readonly request: RequestInit | null,
        readonly cause: unknown,
    ) {
        super(message);
        this.name = "SeamClientError";
    }
}

export function createSeamClient<ApiType>(baseUrl: string, options?: SeamClientOptions): SeamClient<ApiType> {
    return new SeamClient<ApiType>(baseUrl, options);
}

export async function callApi(seamClient: SeamClient<any>, url: string, routerName: string, funcName: string, input?: Record<string, any>, requestOptions?: RequestInit): Promise<any> {
    const req = buildRequest(input, requestOptions ?? {});

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
        throw new SeamClientError("REQUEST_FAILED", "Failed to send request.", url, req, err);
    }

    if (!res.ok) {
        if (res.status == 400) {
            const resError: ResError = await res.json();
            if (resError.isApiError) {
                return {
                    ok: false,
                    error: ApiError.fromJSON(resError.error),
                }
            }
            throw new SeamClientError("REQUEST_FAILED", `Request failed with status ${res.status} ${res.statusText} and non-api error.`, url, req, null);
        }
        throw new SeamClientError("REQUEST_FAILED", `Request failed with status ${res.status} ${res.statusText}.`, url, req, null);
    }

    const contentType = res.headers.get("content-type") || "";

    if (contentType.startsWith("application/json")) {
        const data = await res.json();
        return data.result;
    }

    if (contentType.startsWith("multipart/form-data")) {
        const formData = await res.formData();
        const jsonPart = JSON.parse(formData.get("json")?.toString() || "[]");
        const pathsPart: (string | number)[][] = JSON.parse(formData.get("paths")?.toString() || "[]");
        const datePathsPart: (string | number)[][] = JSON.parse(formData.get("datePaths")?.toString() || "[]");
        const datesPart: string[] = JSON.parse(formData.get("dates")?.toString() || "[]");

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

        const responseDates = datesPart.map((dateString, index) => ({
            path: datePathsPart[index],
            dateString,
        }));
        injectDates(jsonPart, responseDates);

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

        return jsonPart.result;
    }

    throw new SeamClientError("INVALID_CONTENT_TYPE", `Response has invalid content type ${contentType}.`, url, req, null);
}

function buildRequest(input: Record<string, any> = {}, requestOptions: RequestInit): RequestInit {
    let req: RequestInit;

    const { json: jsonAfterFiles, files, paths } = extractFiles(input);
    const { json, dates, paths: datePaths } = extractDates(jsonAfterFiles);

    if (files.length > 0 || dates.length > 0) {
        const formData = new FormData();

        formData.append("json", JSON.stringify(json));
        formData.append("paths", JSON.stringify(paths));
        formData.append("datePaths", JSON.stringify(datePaths));
        formData.append("dates", JSON.stringify(dates));

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            formData.append(`file-${i}`, file, file.name || `file-${i}`);
        }

        req = {
            ...requestOptions,
            method: "POST",
            body: formData,
        };
    } else {
        req = {
            ...requestOptions,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(input),
        };
    }

    return req;
}