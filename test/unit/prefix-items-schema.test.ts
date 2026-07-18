// Regression test for issue #2811: JSON Schema 2020-12 tuple schemas that use
// `prefixItems` must be handled the same as draft-07's array-valued `items`.
//
// `makeArrayType` in JSONSchemaInput only ever read `schema.items`, so a
// `prefixItems`-based tuple (now emitted by Pydantic v2 and Rust's schemars)
// fell through to the generic `any[]` branch, dropping the tuple's member
// types entirely. `prefixItems` was also missing from the type-inference
// predicate that decides whether a schema needs a union/array type at all, so
// a bare `prefixItems` schema was not even recognized as an array.
//
// The fixture harness cannot cover this cleanly: it round-trips sample data
// through the generated code, and an `any[]` degradation still accepts the
// sample, so the lost tuple types would go unnoticed. Here we assert directly
// that the referenced member types survive in the generated output.

import {
    FetchingJSONSchemaStore,
    InputData,
    JSONSchemaInput,
    quicktype,
} from "quicktype-core";
import { describe, expect, test } from "vitest";

// The `$ref`'d member schemas carry distinctively named properties so we can
// assert they are present in the output rather than collapsed to `any[]`.
const defs = {
    Bar: {
        type: "object",
        properties: { barField: { type: "integer" } },
        required: ["barField"],
    },
    Baz: {
        type: "object",
        properties: { bazField: { type: "string" } },
        required: ["bazField"],
    },
};

async function generateTypeScript(schema: object): Promise<string> {
    const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore());
    await schemaInput.addSource({
        name: "Foo",
        schema: JSON.stringify(schema),
    });
    const inputData = new InputData();
    inputData.addInput(schemaInput);

    const result = await quicktype({ inputData, lang: "typescript" });
    return result.lines.join("\n");
}

describe("JSON Schema prefixItems tuples (issue #2811)", () => {
    test("a 2020-12 prefixItems tuple keeps its member types", async () => {
        const output = await generateTypeScript({
            $schema: "https://json-schema.org/draft/2020-12/schema",
            type: "array",
            prefixItems: [{ $ref: "#/$defs/Bar" }, { $ref: "#/$defs/Baz" }],
            $defs: defs,
        });

        // Before the fix this generated a bare `any[]` with no member types.
        expect(output).toContain("barField");
        expect(output).toContain("bazField");
    });

    test("draft-07 array-valued items still works (no regression)", async () => {
        const output = await generateTypeScript({
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "array",
            items: [
                { $ref: "#/definitions/Bar" },
                { $ref: "#/definitions/Baz" },
            ],
            definitions: defs,
        });

        expect(output).toContain("barField");
        expect(output).toContain("bazField");
    });
});
