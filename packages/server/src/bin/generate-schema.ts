#!/usr/bin/env node

import fs from "fs";
import ts, { Node } from "typescript";
import path from "path";
import fg from "fast-glob";

main();

async function main() {
    const args = process.argv;

    if (args.length != 4 && args.length != 5)
        return console.error("Usage: seam-rpc gen-schema <schema-file.ts> [output-file.ts]");

    const inputFiles = await fg(args[3]);
    const outputPath = args[4] || "./src/frontend/api";

    try {
        for (const inputFile of inputFiles) {
            generateSchema(inputFile, outputPath);
        }

        console.log(`✅ Schemas generated at ${outputPath}`);
    } catch (err: any) {
        console.error("❌ Failed to generate schema:", err.message);
        process.exit(1);
    }
}

function generateSchema(inputFile: string, outputPath: string): void {
    const file = path.resolve(process.cwd(), inputFile);

    if (!fs.existsSync(file)) {
        console.error(`File ${file} not found`);
        process.exit(1);
    }

    const imports = ["import { callApi } from \"@seam-rpc/client\";"];
    const apiDef: string[] = [];
    const typeDefs: string[] = [];

    const routerName = path.basename(file, path.extname(file));
    const fileContent = fs.readFileSync(file, "utf-8");

    const sourceFile = ts.createSourceFile(
        file,
        fileContent,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
    );

    ts.forEachChild(sourceFile, (node) => {
        if (ts.isFunctionDeclaration(node)) {
            if (!node.name) {
                console.error("Missing function name");
                process.exit(1);
            }

            const funcName = node.name.getText();

            let signature = `export function ${funcName}(`;
            const paramsText = node.parameters
                .map((p) => {
                    const paramName = p.name.getText();
                    const optional = p.questionToken ? "?" : "";
                    const type = p.type ? p.type.getText() : "any";
                    return `${paramName}${optional}: ${type}`;
                })
                .join(", ");
            const returnType = node.type ? node.type.getText() : "any";
            signature += `${paramsText}): ${returnType} { return callApi("${routerName}", "${funcName}", { ${node.parameters.map(e => e.name.getText()).join(", ")} }); }`;

            apiDef.push(signature);
        } else if (
            ts.isInterfaceDeclaration(node) ||
            ts.isTypeAliasDeclaration(node) ||
            ts.isEnumDeclaration(node)
        ) {
            const text = node.getFullText(sourceFile).trim();
            typeDefs.push(text);
        }
    });

    const content = [imports.join("\n"), typeDefs.join("\n"), apiDef.join("\n")].join("\n");

    fs.writeFileSync(path.resolve(outputPath, path.basename(file)), content, "utf-8");

    console.log(`✅ Schema generated: ${path.basename(file)}`);
}

function hasExportModifier(node: Node) {
    if (
        ts.isVariableStatement(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node)
    ) {
        return !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    }
    return false;
}