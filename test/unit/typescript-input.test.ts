import * as fs from "node:fs";
import * as path from "node:path";

import { schemaForTypeScriptSources } from "quicktype-typescript-input";
import { afterAll, describe, expect, test } from "vitest";

// schemaForTypeScriptSources compiles with `rootDir: "."`, so the input files
// must live under the current working directory (the repository root when
// vitest runs). Use a temp directory inside the repository and pass paths
// relative to the working directory.
const temporaryDirectory = fs.mkdtempSync(
    path.join(process.cwd(), ".tmp-typescript-input-test-"),
);

afterAll(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

let uniqueFileIndex = 0;

function schemaForSource(source: string) {
    const fileName = path.join(
        path.relative(process.cwd(), temporaryDirectory),
        `input-${uniqueFileIndex++}.ts`,
    );
    fs.writeFileSync(fileName, source);
    const result = schemaForTypeScriptSources([fileName]);
    return {
        name: result.name ?? "",
        schema: JSON.parse(result.schema),
        uris: result.uris,
    };
}

describe("schemaForTypeScriptSources", () => {
    test("converts a simple interface", () => {
        const { schema, uris } = schemaForSource(`
            export interface Person {
                name: string;
                age?: number;
            }
        `);

        const person = schema.definitions.Person;
        expect(person.type).toBe("object");
        expect(person.properties.name.type).toBe("string");
        expect(person.properties.age.type).toBe("number");
        expect(person.required).toEqual(["name"]);
        expect(person.additionalProperties).toBe(false);
        expect(uris).toEqual(["#/definitions/"]);
    });

    test("a #TopLevel marker selects the top-level type and is stripped", () => {
        const { name, schema, uris } = schemaForSource(`
            /**
             * The root type. #TopLevel
             */
            export interface Root {
                id: number;
                child: Child;
            }

            export interface Child {
                label: string;
            }
        `);

        expect(name).toBe("Root");
        expect(uris).toEqual(["#/definitions/Root"]);
        expect(schema.definitions.Root.description).not.toContain("#TopLevel");
    });

    test("export default types are rewritten to a named ref", () => {
        const { name, schema } = schemaForSource(`
            export default interface Person {
                name: string;
            }
        `);

        expect(name).toBe("Person");
        expect(schema.definitions.default).toEqual({
            $ref: "#/definitions/Person",
        });
        expect(schema.definitions.Person.type).toBe("object");
    });

    test("class property initializers become defaults", () => {
        const { schema } = schemaForSource(`
            export class Config {
                public name: string = "default-name";

                public count: number = 42;
            }
        `);

        const config = schema.definitions.Config;
        expect(config.properties.name.default).toBe("default-name");
        expect(config.properties.count.default).toBe(42);
    });

    // The previously used fork of typescript-json-schema threw
    // "Unsupported type: bigint" here.
    test("bigint properties are converted to numbers", () => {
        const { schema } = schemaForSource(`
            export interface WithBigint {
                big: bigint;
            }
        `);

        expect(schema.definitions.WithBigint.properties.big.type).toBe(
            "number",
        );
    });

    test("compiler errors are reported as quicktype errors", () => {
        expect(() =>
            schemaForSource(`
                export interface Broken {
                    name: DoesNotExist;
                }
            `),
        ).toThrow(/TypeScript error/);
    });
});
