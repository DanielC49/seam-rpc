export type Result<Data, Error extends ApiError<any, any> | undefined = undefined> =
    Error extends undefined ? | { ok: true; data: Data }
    : { ok: true; data: Data } | { ok: false; error: Error };

export type ResError = {
    isApiError: false;
} | {
    isApiError: true;
    error: ApiErrorInterface<any>;
};

export type ApiErrorInterface<ErrorMap extends Record<string, any>> = {
    [K in keyof ErrorMap]: {
        code: K;
        data?: ErrorMap[K];
    }
}[keyof ErrorMap];

export class ApiError<ErrorMap extends Record<string, any>, Code extends keyof ErrorMap> {
    constructor(public readonly code: Code, public readonly data?: ErrorMap[Code]) { }

    public toString() {
        return this.code.toString() + (this.data !== undefined ? ": " + JSON.stringify(this.data) : "");
    }

    public toJSON() {
        return { code: this.code, data: this.data };
    }

    public static fromJSON(json: { code: any, data?: any }) {
        return new ApiError(json.code, json.data);
    }
}

export function extractFiles(input: unknown) {
    const files: File[] = [];
    const paths: (string | number)[][] = [];

    function walk(value: unknown, path: (string | number)[]): any {
        if (value instanceof File) {
            files.push(value);
            paths.push(path);
            return null;
        }

        if (Array.isArray(value)) {
            return value.map((e, index) => walk(e, [...path, index]));
        }

        if (value && typeof value === "object") {
            return Object.fromEntries(
                Object.entries(value).map(([k, v]) => [k, walk(v, [...path, k])])
            );
        }

        return value;
    }

    return {
        json: walk(input, []),
        files,
        paths,
    };
}

export function injectFiles(json: any, files: { path: (string | number)[], file: File }[]) {
    for (const file of files) {
        for (let i = 0; i < file.path.length; i++) {
            const key = file.path[i];
            if (i < file.path.length - 1)
                json = json[key];
            else
                json[key] = file.file;
        }
    }
}