import fs from "fs";
import path from "path";
import fg from "fast-glob";
import ts from "typescript";
import * as z from "zod";
import { zodToTs, createAuxiliaryTypeStore, printNode } from "zod-to-ts";
import { ProcedureBuilder } from "../index.js";
import { existsSync, writeFileSync } from "fs";
import { SeamConfig } from "./index.js";

export async function genClient() {
    const args = process.argv;
    let config: SeamConfig;

    if (args.length == 3) {
        // Use config

        // Check if config exists
        if (!fs.existsSync("./seam-rpc.config.json"))
            return console.error("\x1b[31mCommand arguments omitted and no config file found.\x1b[0m\n"
                + "Either define a config file with \x1b[36mseam-rpc gen-config\x1b[0m or generate the client files using \x1b[36mseam-rpc gen-client <input-files> <output-folder> [global-types-file]\x1b[0m.");

        // Load config from config file
        config = JSON.parse(fs.readFileSync("./seam-rpc.config.json", "utf-8"));
    } else if (args.length == 5 || args.length == 6) {
        // Use command args

        // Load config from command args
        config = {
            inputFiles: args[3],
            outputFolder: args[4]
        };
    } else {
        // Invalid command usage
        return console.error("Usage: seam-rpc gen-client <input-files> <output-folder>");
    }

    const inputFiles = await fg(config.inputFiles);
    const outputPath = path.resolve(config.outputFolder);
    const rootPath = path.resolve(".");

    // try {
    const outputFiles: string[] = [];

    for (const inputFile of inputFiles) {
        console.log(getProcedureInfo(inputFile));
        // const outputFile = await generateClientFile(inputFile, outputPath);
        // outputFiles.push(removeRootPath(outputFile, rootPath));
    }

    // console.log(
    //     "\x1b[32m%s\x1b[0m\n\x1b[36m%s\x1b[0m",
    //     `✅ Successfully generated client files at ${removeRootPath(outputPath, rootPath)}`,
    //     `${outputFiles.join("\n")}`
    // );
    
    // } catch (err: any) {
    //     console.error("❌ Failed to generate client file:", err.message);
    //     process.exit(1);
    // }
}

interface ProcedureInfo {
    name: string;
    inputType: string;
    outputType: string;
    comments: string;
}

export function getProcedureInfo(filePath: string): ProcedureInfo[] {
    const fullPath = path.resolve(filePath);
    const sourceText = fs.readFileSync(fullPath, "utf8");

    const sourceFile = ts.createSourceFile(
        fullPath,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
    );

    const procedures: ProcedureInfo[] = [];

    function visit(node: ts.Node) {
        // Look for const assignments
        if (ts.isVariableStatement(node)) {
            node.declarationList.declarations.forEach((decl) => {
                if (ts.isIdentifier(decl.name) && decl.initializer) {
                    let varName = decl.name.text;
                    let inputType = "";
                    let outputType = "";
                    let comments = "";

                    const jsDocs = ts.getJSDocCommentsAndTags(node); // node = VariableStatement

                    // Get JSDoc comments
                    if (jsDocs.length > 0) {
                        comments = jsDocs.map(doc => doc.getText()).join("\n");
                    }

                    // Check for chain calls: .input(...).output(...)
                    if (ts.isCallExpression(decl.initializer) || ts.isPropertyAccessExpression(decl.initializer)) {
                        function extractChain(expr: ts.Expression) {
                            if (ts.isCallExpression(expr)) {
                                if (ts.isPropertyAccessExpression(expr.expression)) {
                                    const propName = expr.expression.name.text;
                                    if (propName === "input" && expr.arguments.length > 0) {
                                        inputType = expr.arguments[0].getText();
                                    } else if (propName === "output" && expr.arguments.length > 0) {
                                        outputType = expr.arguments[0].getText();
                                    }
                                    extractChain(expr.expression.expression);
                                }
                            } else if (ts.isPropertyAccessExpression(expr)) {
                                extractChain(expr.expression);
                            }
                        }

                        extractChain(decl.initializer);
                    }

                    if (inputType || outputType || comments) {
                        procedures.push({ name: varName, inputType, outputType, comments });
                    }
                }
            });
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    return procedures;
}

function removeRootPath(path: string, rootPath: string) {
    return "." + path.slice(rootPath.length);
}

async function generateClientFile(sourcePath: string, outputPath: string) {
    const sourceFile = path.resolve(process.cwd(), sourcePath);

    if (!existsSync(sourceFile)) {
        console.error(`File ${sourceFile} not found`);
        process.exit(1);
    }

    const module = await import("file://" + sourceFile);
    const procedures: Record<string, ProcedureBuilder<any, any>> = module.default;
    const routerName = path.basename(sourceFile, path.extname(sourceFile));

    let fileContent = `/* Auto-generated by SeamRPC - DO NOT EDIT */

import { callApi } from \"@seam-rpc/client\";

`;

    // Parse the source file using TypeScript API
    const program = ts.createProgram([sourceFile], {});
    const tsFile = program.getSourceFile(sourceFile)!;

    // Helper to get JSDoc comment for a variable
    function getJsDocComment(node: ts.Node) {
        const jsDocs = (node as any).jsDoc as ts.JSDoc[] | undefined;
        if (!jsDocs || jsDocs.length === 0) return "";
        return jsDocs.map(doc => doc.comment).filter(Boolean).join("\n");
    }

    const functions: string[] = [];

    for (const [procName, proc] of Object.entries(procedures)) {
        // Input
        const input: string[] = [];
        if (proc._def.input) {
            for (const [paramName, param] of Object.entries(proc._def.input)) {
                input.push(`${paramName}${param instanceof z.ZodOptional ? "?" : ""}: ${convert(param as z.ZodType)}`);
            }
        }

        // Output
        const returnType = proc._def.output ? convert(proc._def.output) : "void";

        // Input
        const hasInput = input.length != 0;
        const params = hasInput ? `input: { ${input.join(", ")} }` : "";

        // Function body
        const body = `return callApi("${routerName}", "${procName}"${hasInput ? ", input" : ""});`;

        // Comments
        let comments = "";
        ts.forEachChild(tsFile, node => {
            if (ts.isVariableStatement(node)) {
                node.declarationList.declarations.forEach(decl => {
                    console.log(decl.name.getText(), procName)
                    if (decl.name.getText() === procName) {
                        const doc = getJsDocComment(decl);
                        if (doc) comments = `/** ${doc} */\n`;
                    }
                });
            }
        });

        const func = `${comments}export function ${procName}(${params}): Promise<${returnType}> { ${body} }`;

        functions.push(func);
    }

    fileContent += functions.join("\n\n");

    writeFileSync(`${outputPath}/${routerName}.ts`, fileContent, "utf-8");

    return sourceFile;
}

function convert(schema: z.ZodType) {
    const auxiliaryTypeStore = createAuxiliaryTypeStore();
    const { node } = zodToTs(schema, { auxiliaryTypeStore });
    return printNode(node);
}

// function zodToTs(schema: z.ZodType): { value: string, definition?: string } {
//     if (schema instanceof z.ZodString) {
//         return { value: "string" };
//     }

//     if (schema instanceof z.ZodNumber) {
//         return { value: "number" };
//     }

//     if (schema instanceof z.ZodArray) {
//         return { value: zodToTs(schema.def.type) + "[]" };
//     }

//     if (schema instanceof z.ZodOptional) {
//         return {value: };
//     }

//     return { value: "any" };
// }