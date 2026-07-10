// languageNamed() must accept display names and file extensions, and must
// return undefined for unknown names instead of throwing.
//
// Before quicktype 23.1.0, languageNamed() matched a language's names,
// displayName, and extension, and returned undefined when nothing matched.
// The 23.1.0 rewrite (da1238c0) made it match only the lowercase names
// arrays and *throw* on a miss. That broke consumers that pass display
// names — most visibly app.quicktype.io, which stores the chosen language's
// display name (e.g. "TypeScript") and crashed to a blank page for
// returning users: see https://github.com/glideapps/quicktype/issues/2769.
//
// The fixture harness never calls languageNamed() with anything but exact
// lowercase names, so it can't catch this; we assert on the API directly.

import { isLanguageName, languageNamed } from "quicktype-core";
import { describe, expect, test } from "vitest";

// input → expected displayName of the resolved language
const resolvedCases: Array<[string, string]> = [
    // exact lowercase names (the only thing 23.1.0 accepted)
    ["typescript", "TypeScript"],
    ["c++", "C++"],
    // display names, as saved by app.quicktype.io
    ["TypeScript", "TypeScript"],
    ["C++", "C++"],
    ["Objective-C", "Objective-C"],
    ["JSON Schema", "JSON Schema"],
    // case-insensitive
    ["Typescript", "TypeScript"],
    ["PYTHON", "Python"],
    // extensions (matched only after names and display names, so
    // Flow's extension "js" must not shadow JavaScript's name "js")
    ["kt", "Kotlin"],
    ["js", "JavaScript"],
];

const unknownNames = ["this-is-not-a-language", ""];

describe("languageNamed", () => {
    test.each(resolvedCases)("resolves %j to %j", (input, expected) => {
        expect(languageNamed(input)?.displayName).toBe(expected);
    });

    test.each(resolvedCases)("isLanguageName(%j) is true", (input) => {
        expect(isLanguageName(input)).toBe(true);
    });

    test.each(unknownNames)(
        "returns undefined for unknown name %j",
        (input) => {
            expect(languageNamed(input)).toBeUndefined();
            expect(isLanguageName(input)).toBe(false);
        },
    );
});
