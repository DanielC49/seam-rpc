import { extractFiles, injectFiles, ResError, Result, RpcError } from "@seam-rpc/core";
import EventEmitter from "events";
import express, { Express, NextFunction, Request, RequestHandler, Response, Router } from "express";
import FormData from "form-data";
import * as z from "zod";

export interface RouterDefinition {
    [procName: string]: (...args: any[]) => Promise<any>;
};

type Simplify<T> =
    T extends File
    ? File
    : T extends object
    ? { [K in keyof T]: Simplify<T[K]> }
    : T;

// Context

export interface SeamContext {
    request: Request;
    response: Response;
    next: NextFunction;
}

export interface SeamErrorContext {
    routerPath: string;
    procedureName: string;
    input?: Record<string, unknown> | null;
    validatedInput?: Record<string, unknown> | null;
    output?: unknown;
    validatedOutput?: unknown;
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

// Procedures

type ProcedureHandler<Input extends ProcedureInput, Output extends ProcedureOutput, Errors extends ProcedureErrors> =
    (options: ProcedureOptions<Input, Errors>) => Result<z.infer<Output>, unknown> | Promise<Result<z.infer<Output>, unknown>>;

interface ProcedureOptions<Input extends ProcedureInput, Errors extends ProcedureErrors> {
    input: Simplify<ProcedureInputData<Input>>;
    ctx: SeamContext;
    error: RpcErrorFactory<Errors>;
}

type RpcErrorFactory<Errors extends ProcedureErrors> = <Code extends keyof Errors>(
    code: Code,
    ...args: z.infer<Errors[Code]> extends undefined
        ? []
        : [data: z.infer<Errors[Code]>]
) => void;

type ProcedureInput = Record<string, z.ZodType>;
type ProcedureOutput = z.ZodType;
type ProcedureErrors = Record<string, z.ZodType>;

type ProcedureList = Record<string, SeamProcedure<any, any, any>>;
type ProcedureBuilderList = Record<string, ProcedureBuilder<any, any, any>>;

type ProcedureInputData<T extends ProcedureInput> = {
    [K in keyof T]: z.infer<T[K]>;
};

interface SeamProcedure<Input extends ProcedureInput, Output extends ProcedureOutput, Errors extends ProcedureErrors> {
    input?: Input;
    output?: Output;
    errors?: Errors;
    handler?: ProcedureHandler<Input, Output, Errors>;
}

export type ProcedureBuilder<Input extends ProcedureInput, Output extends ProcedureOutput, Errors extends ProcedureErrors> = {
    _def: SeamProcedure<Input, Output, Errors>;
    input: <T extends ProcedureInput>(schema: T) => ProcedureBuilder<T, Output, Errors>;
    output: <T extends ProcedureOutput>(schema: T) => ProcedureBuilder<Input, T, Errors>;
    errors: <T extends ProcedureErrors>(errors: T) => ProcedureBuilder<Input, Output, T>;
    handler: (handler: ProcedureHandler<Input, Output, Errors>) => ProcedureBuilder<Input, Output, Errors>;
};

const errorHandler: RpcErrorFactory<ProcedureErrors> = (code, ...args) => {
    return new RpcError(code, args[0]);
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

export function seamProcedure(): ProcedureBuilder<ProcedureInput, ProcedureOutput, ProcedureErrors> {
    return createProcedureBuilder();
}

function createProcedureBuilder(
    definition: SeamProcedure<ProcedureInput, ProcedureOutput, ProcedureErrors> = {}
): ProcedureBuilder<ProcedureInput, ProcedureOutput, ProcedureErrors> {
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
        errors: errors => createProcedureBuilder({
            ...definition,
            errors
        }) as any,
        handler: handler => createProcedureBuilder({
            ...definition,
            handler
        }),
    };
}

export class SeamRouter {
    private procedures: ProcedureList = {};
    private router: Router;

    constructor(private seamSpace: SeamSpace, path: string) {
        this.router = Router();

        this.router.post("/:procName", async (req: Request, res: Response, next: NextFunction) => {
            const procedure = this.procedures[req.params.procName];
            if (!procedure || !procedure.handler)
                return res.sendStatus(404);

            let input: Record<string, any> | undefined;
            let validatedInput: Record<string, unknown> | undefined | null = undefined;
            let output: unknown;
            let validatedOutput: unknown;

            // Middleware
            try {
                input = await this.runMiddleware(req, res);
            } catch (err) {
                return res.status(415).send(String(err));
            }

            // Validate input
            try {
                validatedInput = this.validateInput(input, procedure.input);
            } catch (err) {
                seamSpace.emit("inputValidationError", err, {
                    routerPath: path,
                    procedureName: req.params.procName,
                    input,
                    validatedInput,
                    output,
                    validatedOutput,
                    request: req,
                    response: res,
                    next,
                });
                res.sendStatus(400);
                return;
            }

            // Call procedure
            const ctx: SeamContext = {
                request: req,
                response: res,
                next
            };

            try {
                output = await procedure.handler({ input: validatedInput!, ctx, error: errorHandler });
            } catch (error) {
                let errorResult: ResError = { rpcError: false };

                if (error instanceof RpcError) {
                    errorResult = {
                        rpcError: true,
                        error: {
                            code: error.code,
                            data: error.data,
                        }
                    };
                }
                seamSpace.emit("apiError", error, {
                    routerPath: path,
                    procedureName: req.params.procName,
                    input,
                    validatedInput,
                    output,
                    validatedOutput,
                    request: req,
                    response: res,
                    next,
                });
                res.status(400).json(errorResult);
                return;
            }

            // Validate output
            try {
                validatedOutput = this.validateOutput(output, z.object({ ok: true, data: procedure.output }).or(z.object({ ok: false, error: z.any() })));
            } catch (err) {
                seamSpace.emit("outputValidationError", err, {
                    routerPath: path,
                    procedureName: req.params.procName,
                    input,
                    validatedInput,
                    output,
                    validatedOutput,
                    request: req,
                    response: res,
                    next,
                });
                res.sendStatus(500);
                return;
            }

            try {
                const { json, files, paths } = extractFiles({ result: validatedOutput });

                // Does not include file(s)
                if (files.length === 0) {
                    res.json(json);
                    return;
                }

                // Includes file(s)
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
                seamSpace.emit("internalError", error, {
                    routerPath: path,
                    procedureName: req.params.procName,
                    input,
                    validatedInput,
                    output,
                    validatedOutput,
                    request: req,
                    response: res,
                    next: next,
                });
                console.log("INTERNAL ERROR", error)
                res.sendStatus(500); //.send({ error: String(error) });
            }
        });

        seamSpace.app.use(path, this.router);
    }

    private async runMiddleware(req: Request, res: Response) {
        const contentType = req.headers["content-type"] || "";

        const runMiddleware = (middleware: RequestHandler) =>
            new Promise<void>((resolve, reject) =>
                middleware(req, res, err => (err ? reject(err) : resolve()))
            );

        if (contentType.startsWith("application/json")) {
            await runMiddleware(this.seamSpace.jsonParser);
        } else if (contentType.startsWith("multipart/form-data")) {
            await runMiddleware(this.seamSpace.fileHandler);
        } else {
            throw new Error("Unsupported content type.");
        }

        if (contentType.startsWith("application/json"))
            return req.body;

        // multipart/form-data (already checked before)
        let input = JSON.parse(req.body.json);
        const paths = JSON.parse(req.body.paths);
        const files = (req.files ?? []).map((file: any, index: number) => ({
            path: paths[index],
            file: new File([file.buffer], file.originalname, { type: file.mimetype }),
        }));

        injectFiles(input, files);

        return input;
    }

    private validateInput(input?: Record<string, any>, inputSchema?: ProcedureInput) {
        return this.validateData(input, z.object(inputSchema));
    }

    private validateOutput(output?: unknown, procOutput?: ProcedureOutput) {
        return this.validateData(output, procOutput);
    }

    private validateData<T extends z.ZodType>(data?: unknown, schema?: T) {
        if (!schema) {
            if (data)
                throw new Error("Received data, but no data expected.");
            return null;
        }

        if (!data)
            throw new Error("No data was received, but data was expected.");

        return schema.parse(data);
    }

    public addProcedures(procedures: ProcedureBuilderList) {
        for (const proc in procedures) {
            this.procedures[proc] = procedures[proc]._def;
        }
    }
}

export class SeamSpace extends EventEmitter<SeamEvents> {
    private _jsonParser = express.json();

    constructor(private _app: Express, private _fileHandler: RequestHandler) { super(); }

    public createRouter(path: string, procedures: ProcedureBuilderList = {}): SeamRouter {
        const router = new SeamRouter(this, path);
        router.addProcedures(procedures);
        return router;
    }

    public get app() { return this._app; }
    public get jsonParser() { return this._jsonParser; }
    public get fileHandler() { return this._fileHandler; }
}