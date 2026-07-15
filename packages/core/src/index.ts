export type Ok<T> = {
    ok: true;
    data: T;
};

export type Err<E extends ApiError<any, any> = ApiError<any, any>> = {
    ok: false;
    error: E;
};

export type Result<T, E extends ApiError<any, any> = never> =
    | Ok<T>
    | Err<E>;

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

        // Keep Date objects intact so date extraction can process them later.
        if (value instanceof Date) {
            return value;
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

export function extractDates(input: unknown) {
    const dates: string[] = [];
    const paths: (string | number)[][] = [];

    function walk(value: unknown, path: (string | number)[]): any {
        if (value instanceof Date) {
            dates.push(value.toISOString());
            paths.push(path);
            return value.toISOString();
        }

        // Keep File objects intact so file extraction can process them later.
        if (value instanceof File) {
            return value;
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
        dates,
        paths,
    };
}

export function injectDates(json: any, dates: { path: (string | number)[], dateString: string }[]) {
    for (const dateEntry of dates) {
        let current = json;
        for (let i = 0; i < dateEntry.path.length; i++) {
            const key = dateEntry.path[i];
            if (i < dateEntry.path.length - 1)
                current = current[key];
            else
                current[key] = new Date(dateEntry.dateString);
        }
    }
}