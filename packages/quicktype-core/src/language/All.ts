import type { TargetLanguage } from "../TargetLanguage";

import { CJSONTargetLanguage } from "./CJSON";
import { CPlusPlusTargetLanguage } from "./CPlusPlus";
import { CrystalTargetLanguage } from "./Crystal";
import { CSharpTargetLanguage } from "./CSharp";
import { DartTargetLanguage } from "./Dart";
import { ElixirTargetLanguage } from "./Elixir";
import { ElmTargetLanguage } from "./Elm";
import { GoTargetLanguage } from "./Golang";
import { HaskellTargetLanguage } from "./Haskell";
import { JavaTargetLanguage } from "./Java";
import { JavaScriptTargetLanguage } from "./JavaScript";
import { JavaScriptPropTypesTargetLanguage } from "./JavaScriptPropTypes";
import { JSONSchemaTargetLanguage } from "./JSONSchema";
import { KotlinTargetLanguage } from "./Kotlin";
import { ObjectiveCTargetLanguage } from "./Objective-C";
import { PhpTargetLanguage } from "./Php";
import { PikeTargetLanguage } from "./Pike";
import { PythonTargetLanguage } from "./Python";
import { RubyTargetLanguage } from "./Ruby";
import { RustTargetLanguage } from "./Rust";
import { Scala3TargetLanguage } from "./Scala3";
import { SmithyTargetLanguage } from "./Smithy4s";
import { SwiftTargetLanguage } from "./Swift";
import type {
    LanguageDisplayName,
    LanguageName,
    LanguageNameMap,
} from "./types";
import { TypeScriptEffectSchemaTargetLanguage } from "./TypeScriptEffectSchema";
import { FlowTargetLanguage, TypeScriptTargetLanguage } from "./TypeScriptFlow";
import { TypeScriptZodTargetLanguage } from "./TypeScriptZod";

export const all = [
    new CJSONTargetLanguage(),
    new CPlusPlusTargetLanguage(),
    new CrystalTargetLanguage(),
    new CSharpTargetLanguage(),
    new DartTargetLanguage(),
    new ElixirTargetLanguage(),
    new ElmTargetLanguage(),
    new FlowTargetLanguage(),
    new GoTargetLanguage(),
    new HaskellTargetLanguage(),
    new JavaTargetLanguage(),
    new JavaScriptTargetLanguage(),
    new JavaScriptPropTypesTargetLanguage(),
    new JSONSchemaTargetLanguage(),
    new KotlinTargetLanguage(),
    new ObjectiveCTargetLanguage(),
    new PhpTargetLanguage(),
    new PikeTargetLanguage(),
    new PythonTargetLanguage(),
    new RubyTargetLanguage(),
    new RustTargetLanguage(),
    new Scala3TargetLanguage(),
    new SmithyTargetLanguage(),
    new SwiftTargetLanguage(),
    new TypeScriptTargetLanguage(),
    new TypeScriptEffectSchemaTargetLanguage(),
    new TypeScriptZodTargetLanguage(),
] as const;

all satisfies readonly TargetLanguage[];

export function languageNamed<Name extends LanguageName>(
    name: Name,
    targetLanguages?: readonly TargetLanguage[],
): LanguageNameMap[Name];
export function languageNamed(
    name: string,
    targetLanguages?: readonly TargetLanguage[],
): TargetLanguage | undefined;
export function languageNamed(
    name: string,
    targetLanguages: readonly TargetLanguage[] = all,
): TargetLanguage | undefined {
    // Names take precedence over extensions, so that e.g. "js" resolves
    // to JavaScript, not to Flow (whose extension is "js").
    const lowerName = name.toLowerCase();
    const foundLanguage = targetLanguages.find(
        (language) =>
            (language.names as readonly string[]).includes(lowerName) ||
            language.displayName.toLowerCase() === lowerName,
    );

    return (
        foundLanguage ??
        targetLanguages.find(
            (language) => language.extension.toLowerCase() === lowerName,
        )
    );
}

export function isLanguageName(maybeName: string): maybeName is LanguageName {
    return languageNamed(maybeName) !== undefined;
}

export function isLanguageDisplayName(
    maybeName: string,
): maybeName is LanguageDisplayName {
    if (all.some((lang) => lang.displayName === maybeName)) {
        return true;
    }

    return false;
}
