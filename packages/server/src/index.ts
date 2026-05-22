import { extractFiles, injectFiles, ResError, Result, ApiError, ApiErrorInterface } from "@seam-rpc/core";
import EventEmitter from "events";
import express, { Express, NextFunction, Request, RequestHandler, Response, Router } from "express";
import FormData from "form-data";
import * as z from "zod";

export { ApiError };
export type { Result };

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

type ProcedureHandler<Input extends ProcedureInput, Output extends ProcedureOutput> =
    (options: ProcedureOptions<Input>) => Result<z.infer<Output>, ApiError> | Promise<Result<z.infer<Output>, ApiError>>;

interface ProcedureOptions<Input extends ProcedureInput> {
    input: Simplify<ProcedureInputData<Input>>;
    ctx: SeamContext;
}

type ProcedureInput = Record<string, z.ZodType>;
type ProcedureOutput = z.ZodType;
type ProcedureErrors = Record<string, z.ZodType | undefined>;

type ProcedureInputData<T extends ProcedureInput> = {
    [K in keyof T]: z.infer<T[K]>;
};

interface SeamProcedure<
    Input extends ProcedureInput = {},
    Output extends ProcedureOutput = z.ZodUndefined,
    Errors extends ProcedureErrors = {}
> {
    input?: Input;
    output?: Output;
    errors?: Errors;
    handler?: ProcedureHandler<Input, Output>;
}

type ExtractResultError<T> =
    Awaited<T> extends Result<any, infer E>
    ? E
    : never;

type ErrorUnionToMap<E> = {
    [K in E extends ApiErrorInterface<any, infer Code>
    ? Code
    : never]:
    Extract<E, ApiErrorInterface<any, K>> extends ApiErrorInterface<infer Map, K>
    ? Map[K]
    : never;
}

export type ProcedureBuilder<Input extends ProcedureInput = {}, Output extends ProcedureOutput = z.ZodUndefined, Errors extends ProcedureErrors = {}> = {
    _def: SeamProcedure<Input, Output, Errors>;
    input: <T extends ProcedureInput>(schema: T) => ProcedureBuilder<T, Output, Errors>;
    output: <T extends ProcedureOutput>(schema: T) => ProcedureBuilder<Input, T, Errors>;
    handler: <H extends ProcedureHandler<Input, Output>>
        (handler: H) =>
        ProcedureBuilder<Input, Output, ErrorUnionToMap<ExtractResultError<ReturnType<H>>>>
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

export function seamProcedure(): ProcedureBuilder {
    return createProcedureBuilder();
}

function createProcedureBuilder<Input extends ProcedureInput = {}, Output extends ProcedureOutput = z.ZodUndefined, Errors extends ProcedureErrors = {}>(
    definition: SeamProcedure<Input, Output, Errors> = {}
): ProcedureBuilder<Input, Output, Errors> {
    return {
        _def: definition,
        input: schema => createProcedureBuilder<typeof schema, Output, Errors>({
            ...definition,
            input: schema,
        } as any),
        output: schema => createProcedureBuilder<Input, typeof schema, Errors>({
            ...definition,
            output: schema,
        } as any),
        handler: <T>(handler: any) => createProcedureBuilder<Input, Output, ErrorToDataMap<T>>({
            ...definition,
            handler,
        } as any) as any,
    };
}

type ErrorToDataMap<T> = {
    [U in T as U extends { error: ApiError<any, infer E> }
    ? E
    : never]: U extends { data: infer D } ? ToZod<D> : undefined;
};

type ToZod<T> =
    T extends string ? z.ZodString :
    T extends number ? z.ZodNumber :
    T extends boolean ? z.ZodBoolean :
    T extends bigint ? z.ZodBigInt :
    T extends Date ? z.ZodDate :
    T extends undefined ? z.ZodUndefined :
    T extends null ? z.ZodNull :
    T extends any[] ? z.ZodArray<ToZod<T[number]>> :
    T extends Record<string, any>
    ? z.ZodObject<{ [K in keyof T]: ToZod<T[K]> }>
    : z.ZodType;

export type SeamRouterBuilder = Record<string, ProcedureBuilder<any, any, any>>;

function defineSeamRouter(seamSpace: SeamSpace, path: string, seamRouterBuilder: SeamRouterBuilder) {
    const router = Router();

    router.post("/:procName", async (req: Request, res: Response, next: NextFunction) => {
        const procedure = seamRouterBuilder[req.params.procName]._def;

        if (!procedure || !procedure.handler)
            return res.sendStatus(404);

        let input: Record<string, any> | undefined;
        let validatedInput: Record<string, unknown> | undefined | null = undefined;
        let output: Result<any, ApiError> | undefined = undefined;
        let validatedOutput: any;

        // Middleware
        try {
            input = await runMiddleware(seamSpace, req, res);
        } catch (err) {
            console.error(err);
            return res.status(415).send(String(err));
        }

        // Validate input
        try {
            validatedInput = validateInput(input, procedure.input);
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
            next,
        };

        function toResError(error: unknown): ResError {
            if (error instanceof ApiError)
                return { isApiError: true, error: error.toJSON() };
            else
                return { isApiError: false };
        }

        try {
            output = await procedure.handler({ input: validatedInput!, ctx });
        } catch (error) {
            seamSpace.emit("apiError", error, {
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
            seamSpace.emit("apiError", output.error, {
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
            validatedOutput = validateOutput(output, z.object({ ok: z.literal(true), data: procedure.output }).or(z.object({ ok: z.literal(false), error: z.any() })));
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
            res.sendStatus(500);
        }
    });

    seamSpace.app.use(`/${path}`, router);
}

async function runMiddleware(seamSpace: SeamSpace, req: Request, res: Response) {
    const contentType = req.headers["content-type"] || "";

    const runMiddleware = (middleware: RequestHandler) =>
        new Promise<void>((resolve, reject) =>
            middleware(req, res, err => (err ? reject(err) : resolve()))
        );

    if (contentType.startsWith("application/json")) {
        await runMiddleware(seamSpace.jsonParser);
    } else if (contentType.startsWith("multipart/form-data")) {
        await runMiddleware(seamSpace.fileHandler);
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

function validateInput(input?: Record<string, any>, inputSchema?: ProcedureInput) {
    return validateData(input, z.object(inputSchema));
}

function validateOutput(output?: unknown, procOutput?: ProcedureOutput) {
    return validateData(output, procOutput);
}

function validateData<T extends z.ZodType>(data?: unknown, schema?: T) {
    if (!schema) {
        if (data)
            throw new Error("Received data, but no data expected.");
        return null;
    }

    if (!data)
        throw new Error("No data was received, but data was expected.");

    return schema.parse(data);
}

export class SeamSpace extends EventEmitter<SeamEvents> {
    private _jsonParser = express.json();

    constructor(private _app: Express, private _fileHandler: RequestHandler) { super(); }

    public addRouters<T extends Record<string, SeamRouterBuilder>>(routers: T): RouterToClient<T> {
        Object.entries(routers).forEach(e => defineSeamRouter(this, e[0], e[1]));
        return {} as RouterToClient<T>;
    }

    public get app() { return this._app; }
    public get jsonParser() { return this._jsonParser; }
    public get fileHandler() { return this._fileHandler; }
}

type ErrorMapToUnion<
  E extends Record<string, any>
> = {
  [K in keyof E]:
    ApiError<{ [P in K]: E[K] }, K>
}[keyof E];

type ResultFromErrors<
  Data,
  Errors extends Record<string, any>
> =
  | { ok: true; data: Data }
  | (
      ErrorMapToUnion<Errors> extends infer E
        ? E extends ApiError<any, any>
          ? { ok: false; error: E }
          : never
        : never
    );

type InferInput<P> =
  P extends ProcedureBuilder<infer I, any, any>
    ? {
        [K in keyof I]:
          I[K] extends z.ZodType
            ? z.infer<I[K]>
            : never;
      }
    : never;

type InferOutput<P> =
  P extends ProcedureBuilder<any, infer O, any>
    ? O extends z.ZodType
      ? z.infer<O>
      : never
    : never;

type InferErrors<P> =
  P extends ProcedureBuilder<any, any, infer E>
    ? E
    : never;

type ProcedureToFn<P> =
  P extends ProcedureBuilder<any, any, any>
    ? (
        input: InferInput<P>
      ) => Promise<
        ResultFromErrors<
          InferOutput<P>,
          InferErrors<P>
        >
      >
    : never;

type RouterToClient<T> = {
  [K in keyof T]:
    T[K] extends ProcedureBuilder<any, any, any>
      ? ProcedureToFn<T[K]>
      : RouterToClient<T[K]>;
};