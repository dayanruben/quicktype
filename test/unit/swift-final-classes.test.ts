import {
    InputData,
    JSONSchemaInput,
    type RendererOptions,
    quicktype,
} from "../../packages/quicktype-core/src/index.js";
import { describe, expect, test } from "vitest";

async function renderSwift(
    schema: object,
    rendererOptions: RendererOptions = {},
): Promise<string> {
    const schemaInput = new JSONSchemaInput(undefined);
    await schemaInput.addSource({
        name: "TopLevel",
        schema: JSON.stringify(schema),
    });

    const inputData = new InputData();
    inputData.addInput(schemaInput);

    const result = await quicktype({
        inputData,
        lang: "swift",
        rendererOptions,
    });
    return result.lines.join("\n");
}

function classDeclarations(output: string): string[] {
    return output
        .split("\n")
        .filter((line) =>
            /^\s*(?:(?:public|internal)\s+)?(?:final\s+)?class\s+/.test(line),
        );
}

describe("Swift class generation", () => {
    test("marks requested model classes as final", async () => {
        const output = await renderSwift(
            {
                type: "object",
                properties: {
                    child: {
                        type: "object",
                        properties: { name: { type: "string" } },
                        required: ["name"],
                    },
                },
                required: ["child"],
            },
            { "struct-or-class": "class" },
        );
        const declarations = classDeclarations(output);

        expect(declarations).toHaveLength(2);
        expect(declarations).toEqual(
            expect.arrayContaining([
                expect.stringContaining("final class TopLevel"),
                expect.stringContaining("final class Child"),
            ]),
        );
    });

    test("marks cycle breakers and Codable helper classes as final", async () => {
        const output = await renderSwift({
            $ref: "#/definitions/Node",
            definitions: {
                Node: {
                    type: "object",
                    properties: {
                        next: { $ref: "#/definitions/Node" },
                        value: {},
                    },
                    required: ["value"],
                },
            },
        });
        const declarations = classDeclarations(output);

        expect(declarations).toEqual(
            expect.arrayContaining([
                expect.stringContaining("final class TopLevel"),
                expect.stringContaining("final class JSONNull"),
                expect.stringContaining("final class JSONCodingKey"),
                expect.stringContaining("final class JSONAny"),
            ]),
        );
        expect(declarations.every((line) => line.includes("final class"))).toBe(
            true,
        );
    });
});
