import { SeamFile, ISeamFile, extractFiles, injectFiles } from "@seam-rpc/core";
import EventEmitter from "events";
import express, { Express, NextFunction, Request, RequestHandler, Response, Router } from "express";
import FormData from "form-data";

export { SeamFile, ISeamFile };

export interface RouterDefinition {
    [funcName: string]: (...args: any[]) => Promise<any>;
};

export async function createSeamSpace(app: Express, fileHandler?: RequestHandler): Promise<SeamSpace> {
    if (!fileHandler) {
        let multer: any;
        try {
            multer = (await import("multer")).default;
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

export interface SeamErrorContext {
    routerPath: string;
    functionName: string;
    request: Request;
    response: Response;
    next: NextFunction;
};

export interface SeamSpaceEvents {
    apiError: [error: unknown, context: SeamErrorContext];
    internalError: [error: unknown, context: SeamErrorContext];
}

export class SeamSpace extends EventEmitter<SeamSpaceEvents> {
    private jsonParser = express.json();

    constructor(private app: Express, private fileHandler: RequestHandler) {
        super();
    }

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

            let result;
            try {
                const ctx: SeamContext = {
                    request: req,
                    response: res,
                    next
                };
                result = await routerDefinition[req.params.funcName](...args, ctx);
            } catch (error) {
                this.emit("apiError", error, {
                    routerPath: path,
                    functionName: req.params.funcName,
                    request: req,
                    response: res,
                    next: next,
                });
                res.status(400).send({ error: String(error) });
                return;
            }

            try {
                const { json, files, paths } = extractFiles({ result });

                if (files.length === 0) {
                    res.json(json);
                    return;
                }

                const form = new FormData();
                form.append("json", JSON.stringify(json));
                form.append("paths", JSON.stringify(paths));

                files.forEach((file: SeamFile, index: number) => {
                    form.append(`file-${index}`, Buffer.from(file.data), {
                        filename: file.fileName || `file-${index}`,
                        contentType: file.mimeType || "application/octet-stream",
                    });
                });

                res.writeHead(200, form.getHeaders());
                form.pipe(res);
            } catch (error) {
                this.emit("internalError", error, {
                    routerPath: path,
                    functionName: req.params.funcName,
                    request: req,
                    response: res,
                    next: next,
                });
                res.status(500).send({ error: String(error) });
            }
        });

        this.app.use(path, router);
    }
}

export interface SeamContext {
    request: Request;
    response: Response;
    next: NextFunction;
}