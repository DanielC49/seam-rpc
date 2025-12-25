let apiUrl: string | null = null;

export function setApiUrl(url: string) {
    apiUrl = url;
}

export function callApi(routerName: string, funcName: string, args: any[]): Promise<any> {
    return new Promise(async (resolve, reject) => {
        if (!apiUrl)
            throw new Error("Missing API URL");

        let req: RequestInit;

        const { json, files, paths } = extractFiles(args);

        if (files.length > 0) {
            const formData = new FormData();

            formData.append("json", JSON.stringify(json));
            formData.append("json", JSON.stringify(paths));

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const blob = new Blob([new Uint8Array(file.data)], {
                    type: file.mimeType || "application/octet-stream",
                })
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

        const url = `${apiUrl}/${routerName}/${funcName}`;
        let res: Response;

        try {
            res = await fetch(url, req);
        } catch (err) {
            console.log(url, req);
            throw new Error("Failed to send request.\n" + err);
        }

        if (res.ok) {
            resolve((await res.json()).result);
        } else if (res.status == 400) {
            reject((await res.json()));
        } else {
            console.log(res);
            throw new Error("Failed to parse JSON.");
        }
    });
}

function extractFiles(input: unknown) {
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

export class SeamFile {
    constructor(
        public readonly data: Uint8Array,
        public readonly fileName?: string,
        public readonly mimeType?: string
    ) { }
}

// console.log(JSON.stringify(extractFiles(["John", new SeamFile(new Uint8Array([1, 2, 3, 4]))]), null, 4))