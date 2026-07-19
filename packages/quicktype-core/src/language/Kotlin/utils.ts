import type { Type } from "../../Type/index.js";

import {
    allLowerWordStyle,
    allUpperWordStyle,
    combineWords,
    escapeNonPrintableMapper,
    firstUpperWordStyle,
    intToHex,
    isDigit,
    isLetterOrUnderscore,
    isNumeric,
    isPrintable,
    legalizeCharacters,
    splitIntoWords,
    utf32ConcatMap,
} from "../../support/Strings.js";

function isPartCharacter(codePoint: number): boolean {
    return isLetterOrUnderscore(codePoint) || isNumeric(codePoint);
}

function isStartCharacter(codePoint: number): boolean {
    return isPartCharacter(codePoint) && !isDigit(codePoint);
}

const legalizeName = legalizeCharacters(isPartCharacter);

export function kotlinNameStyle(
    isUpper: boolean,
    original: string,
    acronymsStyle: (s: string) => string = allUpperWordStyle,
): string {
    const words = splitIntoWords(original);
    return combineWords(
        words,
        legalizeName,
        isUpper ? firstUpperWordStyle : allLowerWordStyle,
        firstUpperWordStyle,
        isUpper ? allUpperWordStyle : allLowerWordStyle,
        acronymsStyle,
        "",
        isStartCharacter,
    );
}

function unicodeEscape(codePoint: number): string {
    return `\\u${intToHex(codePoint, 4)}`;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const _stringEscape = utf32ConcatMap(
    escapeNonPrintableMapper(isPrintable, unicodeEscape),
);

export function stringEscape(s: string): string {
    // "$this" is a template string in Kotlin so we have to escape $
    return _stringEscape(s).replace(/\$/g, "\\$");
}

// When several union members are guarded by the same JSON node/value type
// (e.g. date, time and enum values are all strings), parse attempts must be
// ordered strictest first: transformed string types (strict ISO parsers),
// then enums (known values only), then plain strings (accept anything).
export function unionMemberMatchPriority(t: Type): number {
    if (t.kind === "date-time" || t.kind === "date" || t.kind === "time") {
        return 0;
    }

    if (t.kind === "enum") {
        return 1;
    }

    if (t.kind === "string") {
        return 2;
    }

    return 3;
}
