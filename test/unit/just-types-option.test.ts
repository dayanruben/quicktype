// Most languages spell "generate plain types without (de)serialization
// helpers" as a `just-types` boolean option, but C# spelled it
// `features=just-types` and Kotlin/Scala/Smithy `framework=just-types`, so
// the CLI's `--just-types` flag was rejected for those languages.  They now
// also accept `just-types`, which forces the corresponding enum option.
import { describe, expect, test } from "vitest";

import {
    InputData,
    type LanguageName,
    type RendererOptions,
    jsonInputForTargetLanguage,
    quicktype,
} from "quicktype-core";

async function linesFor(
    lang: LanguageName,
    rendererOptions: RendererOptions,
): Promise<string> {
    const jsonInput = jsonInputForTargetLanguage(lang);
    await jsonInput.addSource({
        name: "Person",
        samples: ['{"name": "Alice", "age": 37}'],
    });
    const inputData = new InputData();
    inputData.addInput(jsonInput);
    const result = await quicktype({ inputData, lang, rendererOptions });
    return result.lines.join("\n");
}

describe("just-types is accepted by every enum-spelled language", () => {
    test("C#: just-types matches features=just-types", async () => {
        const viaBoolean = await linesFor("csharp", { "just-types": true });
        const viaEnum = await linesFor("csharp", { features: "just-types" });
        expect(viaBoolean).toEqual(viaEnum);
        expect(viaBoolean).not.toContain("JsonConverter");
    });

    test("Kotlin: just-types matches framework=just-types", async () => {
        const viaBoolean = await linesFor("kotlin", { "just-types": true });
        const viaEnum = await linesFor("kotlin", { framework: "just-types" });
        expect(viaBoolean).toEqual(viaEnum);
        expect(viaBoolean).not.toContain("Klaxon");
    });

    test("Scala: just-types matches framework=just-types", async () => {
        const viaBoolean = await linesFor("scala3", { "just-types": true });
        const viaEnum = await linesFor("scala3", { framework: "just-types" });
        expect(viaBoolean).toEqual(viaEnum);
    });

    test("Smithy: just-types is accepted", async () => {
        const viaBoolean = await linesFor("smithy4a", { "just-types": true });
        const viaDefault = await linesFor("smithy4a", {});
        expect(viaBoolean).toEqual(viaDefault);
    });

    test("the boolean wins over a conflicting enum value", async () => {
        const viaBoolean = await linesFor("kotlin", {
            "just-types": true,
            framework: "jackson",
        });
        const plain = await linesFor("kotlin", { framework: "just-types" });
        expect(viaBoolean).toEqual(plain);
    });
});
