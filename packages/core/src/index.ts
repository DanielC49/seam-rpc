export interface ISeamFile {
    readonly data: Uint8Array;
    readonly fileName?: string;
    readonly mimeType?: string;
}

export class SeamFile implements ISeamFile {
    constructor(
        public readonly data: Uint8Array,
        public readonly fileName?: string,
        public readonly mimeType?: string
    ) { }

    public static fromJSON(data: ISeamFile): SeamFile {
        return new SeamFile(data.data, data.fileName, data.mimeType);
    }
}

export function extractFiles(input: unknown) {
    const files: SeamFile[] = [];
    const paths: (string | number)[][] = [];

    function walk(value: unknown, path: (string | number)[]): any {
        if (value instanceof SeamFile) {
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

export function injectFiles(json: any, files: { path: (string | number)[], file: ISeamFile }[]) {
    for (const file of files) {
        let value = json;
        for (let i = 0; i < file.path.length; i++) {
            const key = file.path[i];
            if (i < file.path.length - 1)
                value = value[key];
            else
                value[key] = SeamFile.fromJSON(file.file);
        }
    }
}