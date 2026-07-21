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

test("unevaluatedProperties identifies an object schema", async () => {
    const output = await generateTypeScript({
        unevaluatedProperties: false,
    });

    expect(output).toContain("export interface");
    expect(output).not.toContain("[property: string]");
});
