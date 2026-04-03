import { extractFiles, injectFiles } from "@seam-rpc/core";
import EventEmitter from "events";
import express, { Express, NextFunction, Request, RequestHandler, Response, Router } from "express";
import FormData from "form-data";
import { IncomingMessage, ServerResponse } from "http";
import * as z from "zod";

export interface RouterDefinition {
    [procName: string]: (...args: any[]) => Promise<any>;
};

export interface SeamContext {
    request: Request;
    response: Response;
    next: NextFunction;
}

export interface SeamErrorContext {
    routerPath: string;
    procedureName: string;
    input: Record<string, unknown>;
    request: Request;
    response: Response;
    next: NextFunction;
};

export interface SeamEvents {
    apiError: [error: unknown, context: SeamErrorContext];
    internalError: [error: unknown, context: SeamErrorContext];
    inputValidationError: [error: unknown, context: SeamErrorContext];
    outputValidationError: [error: unknown, context: SeamErrorContext];
}

type ProcedureHandler<Input extends ProcedureInput, Output extends z.ZodType> = (options: ProcedureOptions<Input>) => z.infer<Output> | Promise<z.infer<Output>>;
type ProcedureInput = Record<string, z.ZodType>;
type ProcedureOutput = z.ZodType;

type ProcedureInputData<T extends ProcedureInput> = {
    [K in keyof T]: z.infer<T[K]>;
};

interface ProcedureOptions<T extends ProcedureInput> {
    input: Simplify<ProcedureInputData<T>>;
    ctx: SeamContext;
}

type Simplify<T> = T extends object
    ? { [K in keyof T]: Simplify<T[K]> }
    : T;

interface SeamProcedure<Input extends ProcedureInput, Output extends ProcedureOutput> {
    input?: Input;
    output?: Output;
    handler?: ProcedureHandler<Input, Output>;
}

type ProcedureList = Record<string, SeamProcedure<any, any>>;

export type ProcedureBuilder<Input extends ProcedureInput, Output extends ProcedureOutput> = {
    _def: SeamProcedure<Input, Output>;
    input: <T extends ProcedureInput>(schema: T) => ProcedureBuilder<T, Output>;
    output: <T extends ProcedureOutput>(schema: T) => ProcedureBuilder<Input, T>;
    handler: (handler: ProcedureHandler<Input, Output>) => ProcedureBuilder<Input, Output>;
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

export function seamProcedure(): ProcedureBuilder<ProcedureInput, ProcedureOutput> {
    return createProcedureBuilder();
}

function createProcedureBuilder(definition: SeamProcedure<ProcedureInput, ProcedureOutput> = {}): ProcedureBuilder<ProcedureInput, ProcedureOutput> {
    return {
        _def: definition,
        input: schema => createProcedureBuilder({
            ...definition,
            input: schema,
        }) as any,
        output: schema => createProcedureBuilder({
            ...definition,
            output: schema,
        }) as any,
        handler: handler => createProcedureBuilder({
            ...definition,
            handler
        }),
    };
}

export class SeamRouter extends EventEmitter<SeamEvents> {
    private router: Router;
    private path: string;
    private procedures: ProcedureList = {};

    constructor(path: string, private app: Express, private jsonParser: (req: IncomingMessage, res: ServerResponse, next: NextFunction) => void, private fileHandler: RequestHandler) {
        super();
        this.path = path;
        this.router = Router();

        this.router.post("/:procName", async (req: Request, res: Response, next: NextFunction) => {
            const procedure = this.procedures[req.params.procName];
            if (!procedure || !procedure.handler)
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

            let input: Record<string, any>;

            if (contentType.startsWith("application/json")) {
                input = req.body;
            } else {
                // multipart/form-data (already checked above)
                input = JSON.parse(req.body.json);
                const paths = JSON.parse(req.body.paths);
                const files = (req.files ?? []).map((file: any, index: number) => ({
                    path: paths[index],
                    file: new File([file.buffer], file.originalname, { type: file.mimetype }),
                }));

                injectFiles(input, files);
            }

            let validatedInput: Record<string, unknown> | null;

            // Validate input
            try {
                validatedInput = this.validateData(input, procedure.input);
            } catch (err) {
                this.emit("inputValidationError", err, {
                    routerPath: path,
                    procedureName: req.params.procName,
                    input,
                    request: req,
                    response: res,
                    next: next,
                });
                res.sendStatus(400);
                return;
            }

            let output;
            const ctx: SeamContext = {
                request: req,
                response: res,
                next
            };
            // Call procedure
            try {
                output = await procedure.handler({ input: validatedInput!, ctx });
            } catch (error) {
                this.emit("apiError", error, {
                    routerPath: path,
                    procedureName: req.params.procName,
                    input,
                    request: req,
                    response: res,
                    next: next,
                });
                res.status(400).send({ error: String(error) });
                return;
            }

            // Validate output
            try {
                validatedInput = this.validateData(output, procedure.output);
            } catch (err) {
                this.emit("outputValidationError", err, {
                    routerPath: path,
                    procedureName: req.params.procName,
                    input,
                    request: req,
                    response: res,
                    next: next,
                });
                res.sendStatus(400);
                return;
            }

            try {
                const { json, files, paths } = extractFiles({ result: output });

                if (files.length === 0) {
                    res.json(json);
                    return;
                }

                const form = new FormData();
                form.append("json", JSON.stringify(json));
                form.append("paths", JSON.stringify(paths));

                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const buffer = Buffer.from(await file.arrayBuffer());
                    form.append(`file-${i}`, buffer, {
                        filename: file.name || `file-${i}`,
                        contentType: file.type || "application/octet-stream",
                    });
                }

                res.writeHead(200, form.getHeaders());
                form.pipe(res);
            } catch (error) {
                this.emit("internalError", error, {
                    routerPath: path,
                    procedureName: req.params.procName,
                    input,
                    request: req,
                    response: res,
                    next: next,
                });
                console.log("INTERNAL ERROR", error)
                res.sendStatus(500); //.send({ error: String(error) });
            }
        });

        this.app.use(path, this.router);
    }

    private validateData(data?: Record<string, any>, dataSchema?: ProcedureInput) {
        if (!dataSchema) {
            if (data)
                throw new Error("No data expected.");
            return null;
        }

        if (!data)
            throw new Error("Data expected.");

        const schema = z.object(dataSchema);
        return schema.parse(data);
    }

    public addProcedures(procedures: Record<string, ProcedureBuilder<any, any>>) {
        for (const proc in procedures) {
            this.procedures[proc] = procedures[proc]._def;
        }
    }
}

export class SeamSpace extends EventEmitter<SeamEvents> {
    private jsonParser = express.json();

    constructor(private app: Express, private fileHandler: RequestHandler) {
        super();
    }

    public createRouter(path: string): SeamRouter {
        return new SeamRouter(path, this.app, this.jsonParser, this.fileHandler);
    }
}