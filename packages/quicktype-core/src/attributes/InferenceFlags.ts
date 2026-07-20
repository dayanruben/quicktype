import { TypeAttributeKind } from "./TypeAttributes.js";

export type SchemaArrayProvenance = "explicit" | "inferred";

class SchemaArrayTypeAttributeKind extends TypeAttributeKind<SchemaArrayProvenance> {
    public constructor() {
        super("schemaArrayProvenance");
    }

    public combine(attrs: SchemaArrayProvenance[]): SchemaArrayProvenance {
        return attrs.includes("explicit") ? "explicit" : "inferred";
    }

    public makeInferred(attr: SchemaArrayProvenance): SchemaArrayProvenance {
        return attr;
    }
}

export const schemaArrayTypeAttributeKind = new SchemaArrayTypeAttributeKind();

// Preserve sample-inference semantics when a top-level array is round-tripped
// through quicktype's JSON Schema output.
export const inferredTopLevelSchemaProperty = "qt-inferred-top-level";
