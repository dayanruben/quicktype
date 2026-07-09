import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, test } from "vitest";

const repositoryRoot = process.cwd();
const coreDirectory = path.join(repositoryRoot, "packages", "quicktype-core");
const coreSourceDirectory = path.join(coreDirectory, "src");
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
    test("does not write to stdout when imported", () => {
        const stdout = execFileSync(
            process.execPath,
            ["-e", `require(${JSON.stringify(coreDirectory)});`],
            { encoding: "utf8" },
        );

        expect(stdout).toBe("");
    });

    test("does not use node:-prefixed imports in browser-compatible source", () => {
        expect(findNodeImports(coreSourceDirectory)).toEqual([]);
    });
});
