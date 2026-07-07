// Guard: languageNamed() must accept display names and file extensions, and
// must return undefined for unknown names instead of throwing.
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

export function checkLanguageNamed(): void {
    const failures: string[] = [];

    for (const [input, expected] of resolvedCases) {
        let actual: string;
        try {
            actual = languageNamed(input)?.displayName ?? "undefined";
        } catch (e) {
            actual = `throw: ${e}`;
        }

        if (actual !== expected) {
            failures.push(
                `languageNamed(${JSON.stringify(input)}): expected ${expected}, got ${actual}`,
            );
        }

        if (!isLanguageName(input)) {
            failures.push(
                `isLanguageName(${JSON.stringify(input)}): expected true, got false`,
            );
        }
    }

    for (const input of unknownNames) {
        let actual: string | undefined;
        try {
            actual = languageNamed(input)?.displayName;
        } catch (e) {
            actual = `throw: ${e}`;
        }

        if (actual !== undefined) {
            failures.push(
                `languageNamed(${JSON.stringify(input)}): expected undefined, got ${actual}`,
            );
        }

        if (isLanguageName(input)) {
            failures.push(
                `isLanguageName(${JSON.stringify(input)}): expected false, got true`,
            );
        }
    }

    if (failures.length > 0) {
        const failureList = failures.map((f) => `    ${f}`).join("\n");
        console.error(
            `error: languageNamed()/isLanguageName() regressions:

${failureList}

languageNamed() must resolve names, display names, and extensions
(case-insensitively) and return undefined — not throw — for unknown names.
See https://github.com/glideapps/quicktype/issues/2769`,
        );
        process.exit(1);
    }
}

// Allow running the check standalone:
//   npx ts-node --project test/tsconfig.json test/check-language-named.ts
if (require.main === module) {
    checkLanguageNamed();
    console.error("* languageNamed accepts names, display names, extensions");
}
