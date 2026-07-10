import type { TargetLanguage } from "../TargetLanguage.js";

import type { all } from "./All.js";

type AllLanguages = (typeof all)[number];

export type LanguageDisplayName<
    Language extends TargetLanguage = AllLanguages,
> = Language["displayName"];
export type LanguageName<Language extends TargetLanguage = AllLanguages> =
    Language["names"][number];

export type LanguageDisplayNameMap = {
    [Language in AllLanguages as LanguageDisplayName<Language>]: Language;
};
export type LanguageNameMap = {
    [Language in AllLanguages as LanguageName<Language>]: Language;
};
