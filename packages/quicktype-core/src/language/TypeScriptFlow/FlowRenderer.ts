import type { Name } from "../../Naming";
import { utf16StringEscape } from "../../support/Strings";
import { defined } from "../../support/Support";
import type { ClassType, EnumType } from "../../Type";
import type { JavaScriptTypeAnnotations } from "../JavaScript";

import { TypeScriptFlowBaseRenderer } from "./TypeScriptFlowBaseRenderer";

export class FlowRenderer extends TypeScriptFlowBaseRenderer {
    protected anyType(): string {
        return this._tsFlowOptions.preferUnknown ? "mixed" : "any";
    }

    protected forbiddenNamesForGlobalNamespace(): string[] {
        return ["Class", "Date", "Object", "String", "Array", "JSON", "Error"];
    }

    protected get typeAnnotations(): JavaScriptTypeAnnotations {
        const a = this.anyType();
        return Object.assign({ never: "" }, {
            any: `: ${a}`,
            anyArray: `: ${a}[]`,
            anyMap: `: { [k: string]: ${a} }`,
            string: ": string",
            stringArray: ": string[]",
            boolean: ": boolean",
        });
    }

    protected emitEnum(e: EnumType, enumName: Name): void {
        this.emitDescription(this.descriptionForType(e));
        const lines: string[][] = [];
        this.forEachEnumCase(e, "none", (_, jsonName) => {
            const maybeOr = lines.length === 0 ? "  " : "| ";
            lines.push([maybeOr, '"', utf16StringEscape(jsonName), '"']);
        });
        defined(lines[lines.length - 1]).push(";");

        this.emitLine("export type ", enumName, " =");
        this.indent(() => {
            for (const line of lines) {
                this.emitLine(line);
            }
        });
    }

    protected emitClassBlock(c: ClassType, className: Name): void {
        this.emitBlock(["export type ", className, " = "], ";", () => {
            this.emitClassBlockBody(c);
        });
    }

    protected emitSourceStructure(): void {
        this.emitLine("// @flow");
        this.ensureBlankLine();
        super.emitSourceStructure();
    }
}
