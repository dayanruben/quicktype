import { describe, expect, test } from "vitest";

import {
    InputData,
    jsonInputForTargetLanguage,
    quicktype,
} from "../../packages/quicktype-core/src/index.js";

describe("TypeScript output filename", () => {
    test("uses output filename in TypeScript usage imports", async () => {
        const jsonInput = jsonInputForTargetLanguage("typescript");
        await jsonInput.addSource({
            name: "ExperimentCounts",
            samples: ['{"experiments": 3}'],
        });

        const inputData = new InputData();
        inputData.addInput(jsonInput);
        const result = await quicktype({
            inputData,
            lang: "typescript",
            outputFilename: "src/cli/ExperimentCounts.ts",
        });
        const output = result.lines.join("\n");

        expect(output).toContain(
            '//   import { Convert, ExperimentCounts } from "./ExperimentCounts";',
        );
        expect(output).not.toContain('from "./file"');
    });
});
