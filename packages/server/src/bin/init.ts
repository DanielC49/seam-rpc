import fs from "fs";
import readline from "readline";
import { SeamConfig } from "./index.js";

export async function initConfig() {
    let source = "./src/api/*";
    let compiledFolder = "./dist/api";
    let outputFolder = "../client/src/api";

    if (fs.existsSync("./seam-rpc.config.json")) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question("Config file already exists. Do you want to overwrite it? [Y/n] ", answer => {
            if (answer && answer.toLowerCase() != "y" && answer.toLowerCase() != "yes") {
                console.log("Operation canceled.")
                process.exit(0);
            }
            rl.close();

            createConfig();
        });
    } else {
        createConfig();
    }

    function createConfig() {
        const config: SeamConfig = { source, compiledFolder, outputFolder };

        try {
            fs.writeFileSync("./seam-rpc.config.json", JSON.stringify(config, null, 4), "utf-8");
        } catch (e) {
            console.log("\x1b[31mFailed to create config file ./seam-rpc.config.json\x1b[0m\n" + e);
        }

        console.log(`\x1b[32mSuccessfully created config file ./seam-rpc.config.json\x1b[0m`);
    }
}