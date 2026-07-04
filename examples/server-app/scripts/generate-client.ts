import { copyFileSync, readdirSync, mkdirSync, existsSync, writeFileSync } from "node:fs";

const destFolder = "generated/pm-api-contract";
const rootExports = [`export * from "./api";`];
const rootExportsJs = [];

copyFileSync("dist/api.d.ts", `${destFolder}/api.d.ts`);

for (const folder of readdirSync("dist/api")) {
    if (!existsSync(`${destFolder}/${folder}`))
        mkdirSync(`${destFolder}/${folder}`);

    writeFileSync(`${destFolder}/${folder}/index.js`, `export * from "./types.js";\nexport * from "./validations.js";`);
    copyFileSync(`dist/api/${folder}/types.js`, `${destFolder}/${folder}/types.js`);
    copyFileSync(`dist/api/${folder}/types.js.map`, `${destFolder}/${folder}/types.js.map`);
    copyFileSync(`dist/api/${folder}/types.d.ts`, `${destFolder}/${folder}/types.d.ts`);
    copyFileSync(`dist/api/${folder}/validations.js`, `${destFolder}/${folder}/validations.js`);
    copyFileSync(`dist/api/${folder}/validations.js.map`, `${destFolder}/${folder}/validations.js.map`);
    copyFileSync(`dist/api/${folder}/validations.d.ts`, `${destFolder}/${folder}/validations.d.ts`);

    rootExports.push(`export * from "./${folder}";`);
    rootExportsJs.push(`export * from "./${folder}";`);

    writeFileSync(
        `${destFolder}/${folder}/index.d.ts`,
        `export * from "./types";\nexport * from "./validations";`
    );
}

writeFileSync(`${destFolder}/index.d.ts`, rootExports.join("\n"));
writeFileSync(`${destFolder}/index.js`, rootExportsJs.join("\n"));