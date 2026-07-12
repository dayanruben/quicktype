import type { ConvenienceRenderer } from "../../ConvenienceRenderer.js";
import type { RenderContext } from "../../Renderer.js";
import {
    EnumOption,
    StringOption,
    getOptionValues,
} from "../../RendererOptions/index.js";
import { AcronymStyleOptions, acronymOption } from "../../support/Acronyms.js";
import { assertNever } from "../../support/Support.js";
import { TargetLanguage } from "../../TargetLanguage.js";
import type { LanguageName, RendererOptions } from "../../types.js";

import { KotlinJacksonRenderer } from "./KotlinJacksonRenderer.js";
import { KotlinKlaxonRenderer } from "./KotlinKlaxonRenderer.js";
import { KotlinRenderer } from "./KotlinRenderer.js";
import { KotlinXRenderer } from "./KotlinXRenderer.js";

export const kotlinOptions = {
    framework: new EnumOption(
        "framework",
        "Serialization framework",
        {
            "just-types": "None",
            jackson: "Jackson",
            klaxon: "Klaxon",
            kotlinx: "KotlinX",
        } as const,
        "klaxon",
    ),
    acronymStyle: acronymOption(AcronymStyleOptions.Pascal),
    packageName: new StringOption("package", "Package", "PACKAGE", "quicktype"),
};

export const kotlinLanguageConfig = {
    displayName: "Kotlin",
    names: ["kotlin"],
    extension: "kt",
} as const;

export class KotlinTargetLanguage extends TargetLanguage<
    typeof kotlinLanguageConfig
> {
    public constructor() {
        super(kotlinLanguageConfig);
    }

    public getOptions(): typeof kotlinOptions {
        return kotlinOptions;
    }

    public get supportsOptionalClassProperties(): boolean {
        return true;
    }

    public get supportsUnionsWithBothNumberTypes(): boolean {
        return true;
    }

    protected makeRenderer<Lang extends LanguageName = "kotlin">(
        renderContext: RenderContext,
        untypedOptionValues: RendererOptions<Lang>,
    ): ConvenienceRenderer {
        const options = getOptionValues(kotlinOptions, untypedOptionValues);

        switch (options.framework) {
            case "None":
                return new KotlinRenderer(this, renderContext, options);
            case "Jackson":
                return new KotlinJacksonRenderer(this, renderContext, options);
            case "Klaxon":
                return new KotlinKlaxonRenderer(this, renderContext, options);
            case "KotlinX":
                return new KotlinXRenderer(this, renderContext, options);
            default:
                return assertNever(options.framework);
        }
    }
}
