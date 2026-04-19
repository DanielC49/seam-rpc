#!/usr/bin/env node

import { generateClient } from "./generate.js";
import { initConfig } from "./init.js";

main();

function main() {
    const args = process.argv;

    switch (args[2]) {
        case "generate":
            generateClient();
            break;
        case "init":
            initConfig();
            break;
        default:
            console.log("Commands:\n- \x1b[36msrpc generate\x1b[0m - Generate client files as defined in the config.\n- \x1b[36msrpc init\x1b[0m - Create config file.");
    }
}

export interface SeamConfig {
    source: string;
    compiledFolder: string;
    outputFolder: string;
}