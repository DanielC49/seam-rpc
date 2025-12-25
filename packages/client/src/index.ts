import { SeamFile, ISeamFile, extractFiles, injectFiles } from "@seam-rpc/core";

export { SeamFile, ISeamFile };

let apiUrl: string | null = null;

export function setApiUrl(url: string) {
    apiUrl = url;
}

export async function callApi(routerName: string, funcName: string, args: any[]): Promise<any> {
    if (!apiUrl)
        throw new Error("Missing API URL");

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

    const url = `${apiUrl}/${routerName}/${funcName}`;
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

        return jsonPart.result;
    }
}

// console.log(JSON.stringify(extractFiles(["John", new SeamFile(new Uint8Array([1, 2, 3, 4]))]), null, 4))