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

import { Smithy4sRenderer } from "./Smithy4sRenderer.js";

export enum Framework {
    None = "None",
}

export const smithyOptions = {
    // FIXME: why does this exist
    framework: new EnumOption(
        "framework",
        "Serialization framework",
        { "just-types": Framework.None } as const,
        "just-types",
    ),
    // Smithy only ever generates plain types; the flag is accepted for
    // consistency with the other languages.
    justTypes: new BooleanOption(
        "just-types",
        "Plain types only (the only mode Smithy supports)",
        false,
        "secondary",
    ),
    packageName: new StringOption("package", "Package", "PACKAGE", "quicktype"),
};

export const smithyLanguageConfig = {
    displayName: "Smithy",
    names: ["smithy4a"],
    extension: "smithy",
} as const;

export class SmithyTargetLanguage extends TargetLanguage<
    typeof smithyLanguageConfig
> {
    public constructor() {
        super(smithyLanguageConfig);
    }

    public getOptions(): typeof smithyOptions {
        return smithyOptions;
    }

    public get supportsOptionalClassProperties(): boolean {
        return true;
    }

    public get supportsUnionsWithBothNumberTypes(): boolean {
        return true;
    }

    protected makeRenderer<Lang extends LanguageName = "smithy4a">(
        renderContext: RenderContext,
        untypedOptionValues: RendererOptions<Lang>,
    ): ConvenienceRenderer {
        const options = getOptionValues(smithyOptions, untypedOptionValues);

        switch (options.framework) {
            case Framework.None:
                return new Smithy4sRenderer(this, renderContext, options);
            default:
                return assertNever(options.framework);
        }
    }
}
