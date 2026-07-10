import type { TargetLanguage } from "../TargetLanguage.js";

import { CJSONTargetLanguage } from "./CJSON/index.js";
import { CPlusPlusTargetLanguage } from "./CPlusPlus/index.js";
import { CSharpTargetLanguage } from "./CSharp/index.js";
import { CrystalTargetLanguage } from "./Crystal/index.js";
import { DartTargetLanguage } from "./Dart/index.js";
import { ElixirTargetLanguage } from "./Elixir/index.js";
import { ElmTargetLanguage } from "./Elm/index.js";
import { GoTargetLanguage } from "./Golang/index.js";
import { HaskellTargetLanguage } from "./Haskell/index.js";
import { JSONSchemaTargetLanguage } from "./JSONSchema/index.js";
import { JavaTargetLanguage } from "./Java/index.js";
import { JavaScriptTargetLanguage } from "./JavaScript/index.js";
import { JavaScriptPropTypesTargetLanguage } from "./JavaScriptPropTypes/index.js";
import { KotlinTargetLanguage } from "./Kotlin/index.js";
import { ObjectiveCTargetLanguage } from "./Objective-C/index.js";
import { PhpTargetLanguage } from "./Php/index.js";
import { PikeTargetLanguage } from "./Pike/index.js";
import { PythonTargetLanguage } from "./Python/index.js";
import { RubyTargetLanguage } from "./Ruby/index.js";
import { RustTargetLanguage } from "./Rust/index.js";
import { Scala3TargetLanguage } from "./Scala3/index.js";
import { SmithyTargetLanguage } from "./Smithy4s/index.js";
import { SwiftTargetLanguage } from "./Swift/index.js";
import { TypeScriptEffectSchemaTargetLanguage } from "./TypeScriptEffectSchema/index.js";
import {
    FlowTargetLanguage,
    TypeScriptTargetLanguage,
} from "./TypeScriptFlow/index.js";
import { TypeScriptZodTargetLanguage } from "./TypeScriptZod/index.js";
import type {
    LanguageDisplayName,
    LanguageName,
    LanguageNameMap,
} from "./types.js";

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
    targetLanguages: readonly TargetLanguage[] = all,
): LanguageNameMap[Name] {
    const foundLanguage = targetLanguages.find((language) =>
        language.names.includes(name),
    );
    if (!foundLanguage) {
        throw new Error(`Unknown language name: ${name}`);
    }

    return foundLanguage as LanguageNameMap[Name];
}

export function isLanguageName(maybeName: string): maybeName is LanguageName {
    if (
        all.some((lang) =>
            (lang.names as readonly string[]).includes(maybeName),
        )
    ) {
        return true;
    }

    return false;
}

export function isLanguageDisplayName(
    maybeName: string,
): maybeName is LanguageDisplayName {
    if (all.some((lang) => lang.displayName === maybeName)) {
        return true;
    }

    return false;
}
