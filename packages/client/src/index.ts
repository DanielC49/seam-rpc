import { SeamFile, ISeamFile, extractFiles, injectFiles } from "@seam-rpc/core";

export { SeamFile, ISeamFile };

export type SeamRequestMiddleware = (context: SeamRequestMiddlewareContext) => void | Promise<void>;
export type SeamResponseMiddleware = (context: SeamResponseMiddlewareContext) => void | Promise<void>;

export interface SeamRequestMiddlewareContext {
    request: RequestInit;
    routerName: string;
    funcName: string;
    args: any[];
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

    constructor(public readonly baseUrl: string, public readonly options?: SeamClientOptions) {
        SeamClient._instance = this;
    }

    preRequest(middleware: SeamRequestMiddleware) {
        this.options?.middleware?.request?.push(middleware);
    }

    postRequest(middleware: SeamResponseMiddleware) {
        this.options?.middleware?.response?.push(middleware);
    }
}

export function createClient(baseUrl: string, options?: SeamClientOptions): SeamClient {
    return new SeamClient(baseUrl, options);
}

export async function callApi(routerName: string, funcName: string, args: any[]): Promise<any> {
    if (!SeamClient._instance)
        throw new Error("Seam Client not instantiated.");

    const seamClient = SeamClient._instance;

    const req = buildRequest(args);
    const url = `${seamClient.baseUrl}/${routerName}/${funcName}`;

    if (seamClient.options?.middleware?.request) {
        for (const mw of seamClient.options.middleware.request) {
            await mw({
                request: req,
                routerName,
                funcName,
                args,
            });
        }
    }

    let res: Response;

    try {
        res = await fetch(url, req);
    } catch (err) {
        console.log(url, req, err);
        throw new Error("Failed to send request.\n" + err);
    }

    if (!res.ok) {
        if (res.status == 400) {
            const resError = await res.json();
            throw new Error(resError.error);
        }
        throw new Error(`Request failed with status ${res.status} ${res.statusText}.`);
    }

    const contentType = res.headers.get("content-type") || "";

    if (contentType.startsWith("application/json")) {
        const data = await res.json();
        return data.result;
    } else if (contentType.startsWith("multipart/form-data")) {
        const formData = await res.formData();
        const jsonPart = JSON.parse(formData.get("json")?.toString() || "[]");
        const pathsPart: (string | number)[][] = JSON.parse(formData.get("paths")?.toString() || "[]");

        const responseFiles: { path: (string | number)[]; file: SeamFile }[] = [];

        for (const [key, value] of formData.entries()) {
            if (key.startsWith("file-")) {
                const index = parseInt(key.replace("file-", ""));
                const blob = value as Blob;
                const arrayBuffer = await blob.arrayBuffer();
                responseFiles.push({
                    path: pathsPart[index],
                    file: new SeamFile(new Uint8Array(arrayBuffer), (blob as any).name, blob.type),
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
                    args,
                });
            }
        }

        return jsonPart.result;
    }
}

function buildRequest(args: any[]): RequestInit {
    let req: RequestInit;

    const { json, files, paths } = extractFiles(args);

    if (files.length > 0) {
        const formData = new FormData();

        formData.append("json", JSON.stringify(json));
        formData.append("paths", JSON.stringify(paths));

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const blob = new Blob([new Uint8Array(file.data)], {
                type: file.mimeType || "application/octet-stream",
            });
            formData.append(`file-${i}`, blob, file.fileName || `file-${i}`);
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
            body: JSON.stringify(args),
        };
    }

    return req;
}