import fs from "fs";
import ts, { Node } from "typescript";
import path from "path";
import fg from "fast-glob";
import { SeamConfig } from ".";

export async function genClient() {
    const args = process.argv;
    let config: SeamConfig;

    if (args.length == 3) {
        if (!fs.existsSync("./seam-rpc.config.json"))
            return console.error("\x1b[31mCommand arguments omitted and no config file found.\x1b[0m\n"
                + "Either define a config file with \x1b[36mseam-rpc gen-config\x1b[0m or generate the client files using \x1b[36mseam-rpc gen-client <input-files> <output-folder> [global-types-file]\x1b[0m.");

        config = JSON.parse(fs.readFileSync("./seam-rpc.config.json", "utf-8"));
    } else if (args.length == 5 || args.length == 6) {
        config = {
            inputFiles: args[3],
            outputFolder: args[4]
        };
    } else {
        return console.error("Usage: seam-rpc gen-client <input-files> <output-folder>");
    }

    const inputFiles = await fg(config.inputFiles);
    const outputPath = path.resolve(config.outputFolder);
    const rootPath = path.resolve(".");

    try {
        const outputFiles: string[] = [];

        for (const inputFile of inputFiles) {
            const outputFile = generateClientFile(inputFile, outputPath);
            outputFiles.push(removeRootPath(outputFile, rootPath));
        }

        console.log(
            "\x1b[32m%s\x1b[0m\n\x1b[36m%s\x1b[0m",
            `✅ Successfully generated client files at ${removeRootPath(outputPath, rootPath)}`,
            `${outputFiles.join("\n")}`
        );
    } catch (err: any) {
        console.error("❌ Failed to generate client file:", err.message);
        process.exit(1);
    }
}

function removeRootPath(path: string, rootPath: string) {
    return "." + path.slice(rootPath.length);
}

function generateClientFile(inputFile: string, outputPath: string): string {
    const file = path.resolve(process.cwd(), inputFile);

    if (!fs.existsSync(file)) {
        console.error(`File ${file} not found`);
        process.exit(1);
    }

    const imports = ["import { callApi, SeamFile } from \"@seam-rpc/client\";"];
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
        if (ts.isImportDeclaration(node)) {
            const moduleSpecifier = node.moduleSpecifier.getText().replace(/['"]/g, "");
            if (moduleSpecifier.startsWith("./"))
                imports.push(node.getText());
        } else if (ts.isFunctionDeclaration(node) && hasExportModifier(node)) {
            if (!node.name) {
                console.error("Missing function name.");
                process.exit(1);
            }

            const funcName = node.name.getText();
            const jsDoc = ts.getJSDocCommentsAndTags(node).map(e => e.getFullText()).filter(Boolean).join("\n");

            let signature = `${jsDoc}\nexport function ${funcName}(`;
            const paramsText = node.parameters
                .map((p) => {
                    const paramName = p.name.getText();
                    const optional = p.questionToken ? "?" : "";
                    const type = p.type ? p.type.getText() : "any";
                    return `${paramName}${optional}: ${type}`;
                })
                .join(", ");
            const returnTypeText = node.type?.getText() ?? "any";
            const finalReturnType = returnTypeText.startsWith("Promise<")
                ? returnTypeText
                : `Promise<${returnTypeText}>`;
            signature += `${paramsText}): ${finalReturnType} { return callApi("${routerName}", "${funcName}", [${node.parameters.map(e => e.name.getText()).join(", ")}]); }`;

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

    return file;
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