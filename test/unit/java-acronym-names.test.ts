import { InputData, JSONSchemaInput, quicktype } from "quicktype-core";
import { describe, expect, test } from "vitest";

const enumValue = "MULTI_SPA_IN_GROUP_REJECTED";
const schema = JSON.stringify({
    $schema: "http://json-schema.org/draft-06/schema#",
    type: "object",
    properties: {
        messageCode: {
            type: "string",
            enum: [enumValue],
        },
    },
    required: ["messageCode"],
});

async function javaEnumConstantIdentifier(
    acronymStyle: string,
): Promise<string> {
    const schemaInput = new JSONSchemaInput(undefined);
    await schemaInput.addSource({ name: "TopLevel", schema });
    const inputData = new InputData();
    inputData.addInput(schemaInput);

    const result = await quicktype({
        inputData,
        lang: "java",
        rendererOptions: { "acronym-style": acronymStyle },
    });
    const output = result.lines.join("\n");
    const match = output.match(
        new RegExp(`case (\\w+): return "${enumValue}";`),
    );

    expect(match, `generated Java output:\n${output}`).not.toBeNull();
    return match?.[1] ?? "";
}

describe("Java enum acronym casing", () => {
    test.each(["original", "pascal", "camel", "lowerCase"])(
        "keeps acronyms uppercase with acronym-style=%s",
        async (acronymStyle) => {
            await expect(
                javaEnumConstantIdentifier(acronymStyle),
            ).resolves.toBe(enumValue);
        },
    );
});
