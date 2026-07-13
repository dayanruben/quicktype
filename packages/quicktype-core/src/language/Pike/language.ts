import type { RenderContext } from "../../Renderer.js";
import { TargetLanguage } from "../../TargetLanguage.js";

import { PikeRenderer } from "./PikeRenderer.js";

export const pikeOptions = {};

export const pikeLanguageConfig = {
    displayName: "Pike",
    names: ["pike", "pikelang"],
    extension: "pmod",
} as const;

export class PikeTargetLanguage extends TargetLanguage<
    typeof pikeLanguageConfig
> {
    public constructor() {
        super(pikeLanguageConfig);
    }

    public getOptions(): Record<string, never> {
        return {};
    }

    protected makeRenderer(renderContext: RenderContext): PikeRenderer {
        return new PikeRenderer(this, renderContext);
    }
}
