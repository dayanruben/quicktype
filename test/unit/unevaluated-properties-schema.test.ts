import {
    FetchingJSONSchemaStore,
    InputData,
    JSONSchemaInput,
    quicktype,
} from "quicktype-core";
import { expect, test } from "vitest";

async function generateTypeScript(schema: object): Promise<string> {
    const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore());
    await schemaInput.addSource({
        name: "Object",
        schema: JSON.stringify(schema),
    });
    const inputData = new InputData();
    inputData.addInput(schemaInput);

    const result = await quicktype({
        inputData,
        lang: "typescript",
        rendererOptions: { "just-types": "true" },
    });
    return result.lines.join("\n");
}

test("unevaluatedProperties false closes an object", async () => {
    const output = await generateTypeScript({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: {
            string: { type: "string" },
        },
        unevaluatedProperties: false,
    });

    expect(output).toContain("string?: string;");
    expect(output).not.toContain("[property: string]");
});

test("unevaluatedProperties identifies an object schema", async () => {
    const output = await generateTypeScript({
        unevaluatedProperties: false,
    });

    expect(output).toContain("export interface");
    expect(output).not.toContain("[property: string]");
});
