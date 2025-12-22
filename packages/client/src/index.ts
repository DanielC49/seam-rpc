let apiUrl: string | null = null;

export function setApiUrl(url: string) {
    apiUrl = url;
}

export function callApi(routerName: string, funcName: string, data: any): Promise<any> {
    return new Promise(async (resolve, reject) => {
        if (!apiUrl)
            throw new Error("Missing API URL");

        let req;

        if (Object.keys(data).length == 1 && data["buffer"] instanceof Buffer) {
            req = {
                method: "POST",
                headers: {
                    "Content-Type": "",
                },
                body: JSON.stringify(data),
            };
        } else {
            req = {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            };
        }

        const res = await fetch(`${apiUrl}/${routerName}/${funcName}`, req);

        if (res.ok) {
            resolve((await res.json()).result);
        } else if (res.status == 400) {
            reject((await res.json()));
        } else {
            console.error(res);
        }
    });
}