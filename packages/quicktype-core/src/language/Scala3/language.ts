import type { ConvenienceRenderer } from "../../ConvenienceRenderer.js";
import type { RenderContext } from "../../Renderer.js";
import {
    BooleanOption,
    EnumOption,
    StringOption,
    getOptionValues,
} from "../../RendererOptions/index.js";
import { assertNever } from "../../support/Support.js";
import { TargetLanguage } from "../../TargetLanguage.js";
import type { LanguageName, RendererOptions } from "../../types.js";

import { CirceRenderer } from "./CirceRenderer.js";
import { Scala3Renderer } from "./Scala3Renderer.js";
import { UpickleRenderer } from "./UpickleRenderer.js";

export const scala3Options = {
    framework: new EnumOption(
        "framework",
        "Serialization framework",
        {
            "just-types": "None",
            circe: "Circe",
            upickle: "Upickle",
        } as const,
        "just-types",
    ),
    // The boolean spelling of `--framework just-types`, so that
    // `--just-types` works for Scala like it does for most other
    // languages.
    justTypes: new BooleanOption(
        "just-types",
        "Plain types only (same as framework=just-types)",
        false,
        "secondary",
    ),
    packageName: new StringOption("package", "Package", "PACKAGE", "quicktype"),
};

export const scala3LanguageConfig = {
    displayName: "Scala3",
    names: ["scala3"],
    extension: "scala",
} as const;

export class Scala3TargetLanguage extends TargetLanguage<
    typeof scala3LanguageConfig
> {
    public constructor() {
        super(scala3LanguageConfig);
    }

    public getOptions(): typeof scala3Options {
        return scala3Options;
    }

    public get supportsOptionalClassProperties(): boolean {
        return true;
    }

    public get supportsUnionsWithBothNumberTypes(): boolean {
        return true;
    }

    protected makeRenderer<Lang extends LanguageName = "scala3">(
        renderContext: RenderContext,
        untypedOptionValues: RendererOptions<Lang>,
    ): ConvenienceRenderer {
        if (scala3Options.justTypes.getValue(untypedOptionValues)) {
            untypedOptionValues = {
                ...untypedOptionValues,
                framework: "just-types",
            } as RendererOptions<Lang>;
        }

        const options = getOptionValues(scala3Options, untypedOptionValues);

        switch (options.framework) {
            case "None":
                return new Scala3Renderer(this, renderContext, options);
            case "Upickle":
                return new UpickleRenderer(this, renderContext, options);
            case "Circe":
                return new CirceRenderer(this, renderContext, options);
            default:
                return assertNever(options.framework);
        }
    }
}
