import * as fs from "node:fs";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import * as os from "node:os";
import * as path from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { main as quicktype } from "../../src";

const files: Record<string, string> = {
    "sample.json": JSON.stringify({
        veryUniquePropertyName: "quicktype",
        count: 3,
    }),
    "main.schema": JSON.stringify({
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: {
            referenced: { $ref: "referenced.schema" },
        },
        required: ["referenced"],
    }),
    "referenced.schema": JSON.stringify({
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: {
            veryUniqueReferencedProperty: { type: "string" },
        },
        required: ["veryUniqueReferencedProperty"],
    }),
};

let server: http.Server;
let baseURL: string;

async function generateTypeScript(
    sourceLanguage: string,
    filename: string,
): Promise<string> {
    const outputDirectory = fs.mkdtempSync(
        path.join(os.tmpdir(), "quicktype-url-"),
    );
    const outputPath = path.join(outputDirectory, "out.ts");

    try {
        await quicktype({
            srcLang: sourceLanguage,
            src: [`${baseURL}/${filename}`],
            lang: "typescript",
            out: outputPath,
            topLevel: "TopLevel",
            quiet: true,
            telemetry: "disable",
        });
        return fs.readFileSync(outputPath, "utf8");
    } finally {
        fs.rmSync(outputDirectory, { recursive: true, force: true });
    }
}

beforeAll(async () => {
    server = http.createServer((request, response) => {
        const content = files[path.basename(request.url ?? "")];
        if (content === undefined) {
            response.writeHead(404);
            response.end();
            return;
        }

        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(content);
    });
    await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as AddressInfo;
    baseURL = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
        server.close((error) =>
            error === undefined ? resolve() : reject(error),
        ),
    );
});

describe("native fetch URL inputs", () => {
    test("generates types from a JSON URL", async () => {
        const output = await generateTypeScript("json", "sample.json");
        expect(output).toContain("veryUniquePropertyName");
    });

    test("resolves a relative remote JSON Schema reference", async () => {
        const output = await generateTypeScript("schema", "main.schema");
        expect(output).toContain("veryUniqueReferencedProperty");
    });
});
