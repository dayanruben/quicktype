import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, test } from "vitest";

const repositoryRoot = process.cwd();
const coreDirectory = path.join(repositoryRoot, "packages", "quicktype-core");
const coreSourceDirectory = path.join(coreDirectory, "src");

// Matches static imports/re-exports (`from "node:fs"`), dynamic imports
// (`import("node:fs")`), and CommonJS requires (`require("node:fs")`).
const nodeImportPattern = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']node:/;

function findNodeImports(directory: string): string[] {
    const offenders: string[] = [];

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            offenders.push(...findNodeImports(fullPath));
            continue;
        }

        if (!entry.isFile() || !entry.name.endsWith(".ts")) {
            continue;
        }

        const lines = fs.readFileSync(fullPath, "utf8").split("\n");
        for (let index = 0; index < lines.length; index++) {
            if (nodeImportPattern.test(lines[index])) {
                offenders.push(
                    `${path.relative(repositoryRoot, fullPath)}:${index + 1}: ${lines[index].trim()}`,
                );
            }
        }
    }

    return offenders;
}

describe("quicktype-core package", () => {
    // Importing the built quicktype-core must not print anything: CLI users
    // redirect stdout (`quicktype ... > out.ts`), so any stray output
    // corrupts generated code. A CI-only fetch shim with a top-level
    // console.info shipped in every published package from 23.3.1 until the
    // fix — see https://github.com/glideapps/quicktype/issues/2874.
    test("does not write to stdout when imported", () => {
        const stdout = execFileSync(
            process.execPath,
            ["-e", `require(${JSON.stringify(coreDirectory)});`],
            { encoding: "utf8" },
        );

        expect(stdout).toBe("");
    });

    // quicktype-core must stay bundleable for the browser: its package.json
    // declares `"browser": { "fs": false }`, which tells web bundlers to stub
    // out the `fs` module — but that mapping only matches the *bare*
    // specifier "fs". A "node:"-prefixed import is NOT remapped, so it breaks
    // web bundles even though Node behaves the same. This regressed once
    // between 23.2.0 and 23.2.5 — see
    // https://github.com/glideapps/quicktype/issues/2763. The guard is scoped
    // to quicktype-core; the CLI in the root src/ directory is Node-only and
    // may use "node:" imports freely.
    test("does not use node:-prefixed imports in browser-compatible source", () => {
        expect(findNodeImports(coreSourceDirectory)).toEqual([]);
    });
});
