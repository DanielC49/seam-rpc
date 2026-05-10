import { extractFiles, injectFiles, ResError, Result, ApiError } from "@seam-rpc/core";
import EventEmitter from "events";
import express, { Express, NextFunction, Request, RequestHandler, Response, Router } from "express";
import FormData from "form-data";
import * as z from "zod";

export { ApiError as RpcError };
export type { Result };

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
    (options: ProcedureOptions<Input, Errors>) => Result<z.infer<Output>, ApiError> | Promise<Result<z.infer<Output>, ApiError>>;

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
    return new ApiError(code, args[0]);
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

export function seamRouter(path: string, procedures: ProcedureBuilderList): SeamRouter {
    return new SeamRouter(path, procedures);
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

export class SeamRouter extends EventEmitter<SeamEvents> {
    private _procedures: ProcedureList = {};
    private _router: Router;

    constructor(path: string, procedures: ProcedureBuilderList) {
        super();
        this._router = Router();
        for (const proc in procedures) {
            this._procedures[proc] = procedures[proc]._def;
        }
        // seamSpace.app.use(path, this._router);

        this._router.post("/:procName", async (req: Request, res: Response, next: NextFunction) => {
            const procedure = this._procedures[req.params.procName];
            if (!procedure || !procedure.handler)
                return res.sendStatus(404);

            let input: Record<string, any> | undefined;
            let validatedInput: Record<string, unknown> | undefined | null = undefined;
            let output: Result<any, ApiError> | undefined = undefined;
            let validatedOutput: any;

            // Middleware
            try {
                input = await this.runMiddleware(req, res);
            } catch (err) {
                console.error(err);
                return res.status(415).send(String(err));
            }

            // Validate input
            try {
                validatedInput = this.validateInput(input, procedure.input);
            } catch (err) {
                this.emit("inputValidationError", err, {
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
                next,
            };

            function toResError(error: unknown): ResError {
                if (error instanceof ApiError)
                    return { isApiError: true, error: error.toJSON() };
                else
                    return { isApiError: false };
            }

            try {
                output = await procedure.handler({ input: validatedInput!, ctx, error: errorHandler });
            } catch (error) {
                this.emit("apiError", error, {
                    routerPath: path,
                    procedureName: req.params.procName,
                    input,
                    validatedInput,
                    output,
                    validatedOutput,
                    request: req,
                    response: res,
                    next: () => { res.status(400).json(toResError(error)); return next(); },
                });
                return;
            }

            if (!output.ok) {
                this.emit("apiError", output.error, {
                    routerPath: path,
                    procedureName: req.params.procName,
                    input,
                    validatedInput,
                    output,
                    validatedOutput,
                    request: req,
                    response: res,
                    next: () => { res.status(400).json(toResError(output.error)); return next(); },
                });
                return;
            }

            // Validate output
            try {
                validatedOutput = this.validateOutput(output, z.object({ ok: z.literal(true), data: procedure.output }).or(z.object({ ok: z.literal(false), error: z.any() })));
            } catch (err) {
                this.emit("outputValidationError", err, {
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
                this.emit("internalError", error, {
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
                res.sendStatus(500); //.send({ error: String(error) });
            }
        });
    }

    get router() {
        return this._router;
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