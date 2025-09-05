let apiUrl: string | null = null;

export function setApiUrl(url: string) {
    apiUrl = url;
}

export function callApi(routerName: string, funcName: string, data: any): Promise<any> {
    return new Promise(async (resolve, reject) => {
        if (!apiUrl)
            return console.error("Missing API URL");

        const res = await fetch(`${apiUrl}/${routerName}/${funcName}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        if (res.ok) {
            resolve((await res.json()).result);
        } else if (res.status == 400) {
            reject((await res.json()));
        } else {
            console.error(res);
        }
    });
}