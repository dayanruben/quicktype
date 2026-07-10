import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import * as esbuild from "esbuild";
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

    // quicktype-core is a dual CJS/ESM package (issue #2906): the "exports"
    // map routes `require` to the CommonJS build in dist/ and `import` to the
    // ES module build in dist/esm/. The tests below guard both legs. They
    // resolve from child Node processes rather than through vitest because
    // vite's resolver is more lenient than Node's and would mask mistakes in
    // the exports map.

    test("require() resolves to the CommonJS build", () => {
        const resolved = execFileSync(
            process.execPath,
            ["-p", "require.resolve('quicktype-core')"],
            { cwd: repositoryRoot, encoding: "utf8" },
        ).trim();

        expect(resolved).toBe(path.join(coreDirectory, "dist", "index.js"));
    });

    test("import resolves to the ES module build", () => {
        const resolved = execFileSync(
            process.execPath,
            [
                "--input-type=module",
                "-e",
                "console.log(import.meta.resolve('quicktype-core'))",
            ],
            { cwd: repositoryRoot, encoding: "utf8" },
        ).trim();

        expect(resolved).toBe(
            pathToFileURL(path.join(coreDirectory, "dist", "esm", "index.js"))
                .href,
        );
    });

    // Loading the ESM entry point executes the entire ES module graph, so
    // this catches extensionless relative specifiers (Node's ESM loader does
    // no extension guessing) as well as named-import interop breakage against
    // CommonJS dependencies (e.g. UMD packages whose named exports
    // cjs-module-lexer cannot detect). It then runs a tiny end-to-end
    // generation to make sure the build actually works, not just parses.
    test("the ES module build loads as real ESM and generates code", async () => {
        const entry = pathToFileURL(
            path.join(coreDirectory, "dist", "esm", "index.js"),
        ).href;
        const script = `
            const { quicktype, InputData, jsonInputForTargetLanguage } =
                await import(${JSON.stringify(entry)});
            const input = jsonInputForTargetLanguage("typescript");
            await input.addSource({
                name: "Person",
                samples: ['{"name":"Alice","age":30}'],
            });
            const inputData = new InputData();
            inputData.addInput(input);
            const result = await quicktype({ inputData, lang: "typescript" });
            if (result.lines.length === 0) throw new Error("no output");
            console.log("ok");
        `;
        const stdout = execFileSync(
            process.execPath,
            ["--input-type=module", "-e", script],
            { cwd: repositoryRoot, encoding: "utf8" },
        );

        expect(stdout.trim()).toBe("ok");
    });

    // The published tarball must contain both builds and the {"type":
    // "module"} marker that makes Node and TypeScript treat dist/esm/ as ESM
    // — without the marker the ESM build would be loaded as CommonJS and
    // every import would fail at runtime.
    test("npm pack includes both builds and the ESM marker", () => {
        const packOutput = execFileSync(
            "npm",
            ["pack", "--dry-run", "--json"],
            { cwd: coreDirectory, encoding: "utf8" },
        );
        const [{ files }] = JSON.parse(packOutput) as Array<{
            files: Array<{ path: string }>;
        }>;
        const paths = new Set(files.map((file) => file.path));

        for (const required of [
            "dist/index.js",
            "dist/index.d.ts",
            "dist/esm/index.js",
            "dist/esm/index.d.ts",
            "dist/esm/package.json",
        ]) {
            expect(paths, `tarball must contain ${required}`).toContain(
                required,
            );
        }

        expect(
            JSON.parse(
                fs.readFileSync(
                    path.join(coreDirectory, "dist", "esm", "package.json"),
                    "utf8",
                ),
            ),
        ).toEqual({ type: "module" });
    });

    // quicktype-core is used in browsers (app.quicktype.io); the "browser"
    // field stubs out fs/path. Bundling the ESM build for the browser proves
    // that the exports map, the ESM graph, and the browser stubs all work
    // together for web bundlers.
    test("the ES module build bundles for the browser", async () => {
        const result = await esbuild.build({
            entryPoints: [path.join(coreDirectory, "dist", "esm", "index.js")],
            bundle: true,
            write: false,
            platform: "browser",
            logLevel: "silent",
        });

        expect(result.errors).toEqual([]);
        expect(result.outputFiles[0].contents.length).toBeGreaterThan(0);
    });
});
