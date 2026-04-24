import fs from "fs";
import path from "path";
import fg from "fast-glob";
import ts from "typescript";
import * as z from "zod";
import { zodToTs, createAuxiliaryTypeStore, printNode } from "zod-to-ts";
import { existsSync, writeFileSync } from "fs";
import { SeamConfig } from "./index.js";

export async function generateClient() {
    const config = loadConfig();
    if (!config) return;

    const sourceFiles = await fg(config.source);
    const compiledFolder = path.resolve(config.compiledFolder);
    const outputPath = path.resolve(config.outputFolder);
    const rootPath = path.resolve(".");

    function removeRootPath(path: string) {
        return "." + path.slice(rootPath.length);
    }

    // try {
    const outputFiles: string[] = [];

    for (let i = 0; i < sourceFiles.length; i++) {
        const sourceFile = sourceFiles[i];
        const path = await generateClientFile({ tsPath: sourceFile, jsPath: compiledFolder, outputPath });
        const symb = i < sourceFiles.length - 1 ? " ├╴" : " └╴";
        outputFiles.push(symb + removeRootPath(path));
    }

    console.log(
        "\x1b[32m\x1b[1m%s\x1b[0m\n\x1b[94m%s\x1b[0m",
        `✅ Successfully generated client files at ${config.outputFolder}`,
        `${outputFiles.join("\n")}`
    );

    // } catch (err: any) {
    //     console.error("❌ Failed to generate client file:", err.message + "\n\n", err.stack);
    //     process.exit(1);
    // }
}

function loadConfig(): SeamConfig | null {
    // Check if config exists
    if (!fs.existsSync("./seam-rpc.config.json")) {
        console.error("\x1b[31mNo config file found.\x1b[0m\n Create a config file with \x1b[36msrpc init\x1b[0m.");
        return null;
    }

    // Load config from config file
    return JSON.parse(fs.readFileSync("./seam-rpc.config.json", "utf-8"));
}

interface GenerateOptions {
    tsPath: string;
    jsPath: string;
    outputPath: string;
}

// Extracts comments from TS file.
export function getProcedureMetadata(filePath: string) {
    const sourceText = fs.readFileSync(filePath, "utf8");

    const program = ts.createProgram([filePath], {
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.CommonJS,
        strict: true,
    });

    const checker = program.getTypeChecker();

    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) return {};

    const metadata: Record<
        string,
        { comment: string; returnType?: string }
    > = {};

    function getHandlerReturnType(node: ts.Expression): string | undefined {
        let current: ts.Expression | undefined = node;

        while (current) {
            if (
                ts.isCallExpression(current) &&
                ts.isPropertyAccessExpression(current.expression)
            ) {
                const prop: any = current.expression;

                if (prop.name.text === "handler") {
                    const handlerFn = current.arguments[0];

                    if (
                        handlerFn &&
                        (ts.isArrowFunction(handlerFn) ||
                            ts.isFunctionExpression(handlerFn))
                    ) {
                        const signature =
                            checker.getSignatureFromDeclaration(handlerFn);

                        if (!signature) return;

                        const returnType =
                            checker.getReturnTypeOfSignature(signature);

                        return checker.typeToString(returnType);
                    }
                }

                current = prop.expression;
                continue;
            }

            break;
        }

        return;
    }

    function visit(node: ts.Node) {
        if (ts.isVariableStatement(node)) {
            const comment = getFullComment(node, sourceText);

            for (const decl of node.declarationList.declarations) {
                if (!ts.isIdentifier(decl.name)) continue;

                const name = decl.name.text;

                let returnType: string | undefined;

                if (decl.initializer) {
                    returnType = getHandlerReturnType(decl.initializer);
                }

                metadata[name] = {
                    comment,
                    returnType,
                };
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    return metadata;
}

function getFullComment(node: ts.Node, sourceText: string): string {
    const ranges = ts.getLeadingCommentRanges(sourceText, node.pos);

    if (!ranges) return "";

    for (const range of ranges) {
        const comment = sourceText.slice(range.pos, range.end);

        // Only keep JSDoc-style comments
        if (comment.startsWith("/**")) {
            return comment;
        }
    }

    return "";
}

function convert(schema: z.ZodType): string {
    const store = createAuxiliaryTypeStore();
    const { node } = zodToTs(schema, { auxiliaryTypeStore: store });
    return printNode(node);
}

export async function generateClientFile({
    tsPath,
    jsPath,
    outputPath,
}: GenerateOptions) {
    const tsFile = path.resolve(process.cwd(), tsPath);
    const tsFileName = path.basename(tsFile).slice(0, -path.extname(tsFile).length);
    const jsFile = path.resolve(process.cwd(), path.join(jsPath, tsFileName + ".js"));

    if (!existsSync(tsFile)) {
        throw new Error(`TS file not found: ${tsFile}`);
    }

    if (!existsSync(jsFile)) {
        throw new Error(`JS file not found: ${jsFile}`);
    }

    const mod = await import("file://" + jsFile);
    const procedures: Record<string, any> = mod.default;
    const routerName = path.basename(jsFile, path.extname(jsFile));
    const procMetadata = getProcedureMetadata(tsFile);

    let output = `/**
 * +===================================+
 * |  File auto-generated by SeamRPC.  |
 * |        --- DO NOT EDIT ---        |
 * +===================================+
 */

import { callApi, Result, RpcError } from "@seam-rpc/client";

`;

    const functions: string[] = [];

    for (const [name, proc] of Object.entries(procedures)) {
        // Input
        let inputType = "void";
        let hasInput = false;

        if (proc._def.input) {
            const fields: string[] = [];

            for (const [key, schema] of Object.entries(proc._def.input)) {
                const isOptional =
                    (schema as any).isOptional?.() ?? false;

                const tsType = convert(schema as z.ZodType);

                fields.push(`${key}${isOptional ? "?" : ""}: ${tsType}`);
            }

            if (fields.length > 0) {
                inputType = `{ ${fields.join("; ")} }`;
                hasInput = true;
            }
        }

        // const dataType = proc._def.output ? convert(proc._def.output) : "void";
        // const errors = Object.entries(proc._def.errors ?? {});
        // const errorType = errors.map(e => `RpcError<"${e[0]}", ${convert(e[1] as any)}>`).join(" | ");
        // const fullReturnType = `Promise<Result<${dataType}${errors.length > 0 ? `, ${errorType}` : ""}>>`;
        const fullReturnType = procMetadata[name].returnType;
        const params = hasInput ? `input: ${inputType}` : "";
        const args = [`"${routerName}"`, `"${name}"`];
        if (hasInput) args.push("input");
        const call = `callApi(${args.join(", ")})`;
        const comment = procMetadata[name].comment ? procMetadata[name].comment + "\n" : "";

        const func = `${comment}export function ${name}(${params}): ${fullReturnType} {
    return ${call};
}`;

        functions.push(func);
    }

    output += functions.join("\n\n");
    const outFile = path.join(outputPath, `${routerName}.ts`);
    writeFileSync(outFile, output, "utf-8");
    return outFile;
}