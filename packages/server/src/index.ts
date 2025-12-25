import express, { Express, NextFunction, Request, RequestHandler, Response, Router } from "express";

export interface RouterDefinition {
    [funcName: string]: (...args: any[]) => Promise<any>;
};

export function createSeamSpace(app: Express, fileHandler?: RequestHandler): SeamSpace {
    if (!fileHandler) {
        let multer: any;
        try {
            multer = require("multer");
        } catch {
            throw new Error(
                "Multer is required as default file handler. Install it or provide a custom fileHandler."
            );
        }
        const upload = multer();
        fileHandler = upload.any();
    }

    return new SeamSpace(app, fileHandler!);
}

export class SeamSpace {
    private jsonParser = express.json();

    constructor(private app: Express, private fileHandler: RequestHandler) { }

    public createRouter(path: string, routerDefinition: RouterDefinition): void {
        const router = Router();

        router.post("/:funcName", async (req: Request, res: Response, next: NextFunction) => {
            if (!(req.params.funcName in routerDefinition))
                return res.sendStatus(404);

            const contentType = req.headers["content-type"] || "";

            const runMiddleware = (middleware: RequestHandler) =>
                new Promise<void>((resolve, reject) =>
                    middleware(req, res, err => (err ? reject(err) : resolve()))
                );

            if (contentType.startsWith("application/json")) {
                await runMiddleware(this.jsonParser);
            } else if (contentType.startsWith("multipart/form-data")) {
                await runMiddleware(this.fileHandler);
            } else {
                return res.status(415).send("Unsupported content type");
            }

            let args: any[];

            if (contentType.startsWith("application/json")) {
                args = req.body;
            } else {
                // multipart/form-data
                args = JSON.parse(req.body.json);
                const paths = JSON.parse(req.body.paths);
                const files = (req.files ?? []).map((file: any, index: number) => ({
                    path: paths[index],
                    file: new SeamFile(file.buffer, file.originalname, file.mimetype),
                }));

                injectFiles(args, files);
            }

            try {
                const result = await routerDefinition[req.params.funcName](...args);
                res.send(JSON.stringify({ result }));
            } catch (error) {
                res.status(400).send({ error: String(error) });
            }
        });

        this.app.use(path, router);
    }
}

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

function injectFiles(json: any, files: { path: (string | number)[], file: ISeamFile }[]) {
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