// Regression check for issue #2869: schema inputs given as Windows absolute
// paths must work.
//
// urijs parses the drive letter of a Windows absolute path such as
// "C:\Users\me\top.schema.json" as a URI *scheme* ("c:"), so the address is
// mangled (lowercased scheme, backslashes kept as an opaque path) and
// relative $refs resolve to bogus addresses like "c:///item.schema.json",
// which NodeIO then tries to fetch as HTTP URLs. The reported failures are
// "Could not fetch schema ..." and "Internal error: Defined value expected".
//
// The fix converts Windows absolute paths (drive-letter and UNC) to "file:"
// URIs before urijs sees them, and teaches NodeIO to read "file:" URIs from
// disk. On POSIX the resulting drive-letter file path ("C:/Users/me/...") is
// read relative to the working directory, which is what lets us test the
// whole pipeline on Linux CI: we create a literal "C:/Users/me/" directory
// tree in a temp dir, chdir into it, and run quicktype with the Windows-style
// path the issue reported. The fixture harness cannot cover this because its
// inputs are always plain POSIX paths.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
    FetchingJSONSchemaStore,
    InputData,
    JSONSchemaInput,
    quicktype,
} from "quicktype-core";

const topLevelSchema = JSON.stringify({
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "array",
    items: { $ref: "item.schema.json" },
});

const itemSchema = JSON.stringify({
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    properties: { name: { type: "string" } },
    required: ["name"],
});

interface SchemaPathCase {
    description: string;
    // The path passed to quicktype, as a user would type it.
    schemaArg: (tempDir: string) => string;
    // Where to create the schema files, relative to the temp dir.
    schemaDir: string;
}

const cases: SchemaPathCase[] = [
    {
        description: "Windows absolute path with backslashes",
        schemaDir: "C:/Users/quicktype",
        schemaArg: () => "C:\\Users\\quicktype\\top.schema.json",
    },
    {
        description: "Windows absolute path with forward slashes",
        schemaDir: "C:/Users/quicktype",
        schemaArg: () => "C:/Users/quicktype/top.schema.json",
    },
    {
        // Must keep working exactly as before the fix.
        description: "POSIX absolute path",
        schemaDir: "posix",
        schemaArg: (tempDir) => path.join(tempDir, "posix", "top.schema.json"),
    },
];

async function generateTypeScript(schemaURI: string): Promise<string> {
    // The same setup the CLI uses for `-s schema <path>`.
    const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore());
    await schemaInput.addSource({ name: "TopLevel", uris: [schemaURI] });
    const inputData = new InputData();
    inputData.addInput(schemaInput);

    const result = await quicktype({ inputData, lang: "typescript" });
    return result.lines.join("\n");
}

async function runCase(c: SchemaPathCase): Promise<string | undefined> {
    const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "quicktype-windows-paths-"),
    );
    const previousCwd = process.cwd();
    try {
        const schemaDir = path.join(tempDir, c.schemaDir);
        fs.mkdirSync(schemaDir, { recursive: true });
        fs.writeFileSync(
            path.join(schemaDir, "top.schema.json"),
            topLevelSchema,
        );
        fs.writeFileSync(path.join(schemaDir, "item.schema.json"), itemSchema);

        // On POSIX the drive-letter path is read relative to the working
        // directory, so the "C:/Users/quicktype" tree must be under the cwd.
        process.chdir(tempDir);
        const output = await generateTypeScript(c.schemaArg(tempDir));

        // The item schema is only reachable through the relative $ref, so
        // this asserts that $ref resolution against the address works, too.
        if (!/name\s*:\s*string/.test(output)) {
            return `    ${c.description}: generated output does not contain the type from the $ref'd schema:\n${output}`;
        }

        return undefined;
    } catch (e) {
        return `    ${c.description}: quicktype failed: ${e}`;
    } finally {
        process.chdir(previousCwd);
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

export async function checkWindowsSchemaPaths(): Promise<void> {
    const failures: string[] = [];
    for (const c of cases) {
        const failure = await runCase(c);
        if (failure !== undefined) {
            failures.push(failure);
        }
    }

    if (failures.length > 0) {
        console.error(
            `error: schema inputs given as absolute paths must work (issue #2869):

${failures.join("\n")}

Windows absolute paths (drive-letter and UNC) must be converted to "file:"
URIs before urijs parses them — see normalizeURI and friends in
packages/quicktype-core/src/input/JSONSchemaInput.ts and the "file:" URI
handling in packages/quicktype-core/src/input/io/NodeIO.ts.`,
        );
        process.exit(1);
    }
}

// Allow running the check standalone:
//   NODE_PATH=`pwd`/node_modules npx ts-node --project test/tsconfig.json test/check-windows-schema-paths.ts
if (require.main === module) {
    checkWindowsSchemaPaths().then(() => {
        console.error(
            "* Schema inputs given as Windows and POSIX absolute paths work",
        );
    });
}
