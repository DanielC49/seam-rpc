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