# JSON Schema comment injection

## TypeScript reproduction

Added a focused schema fixture:

- `test/inputs/schema/comment-injection.schema`
- `test/inputs/schema/comment-injection.1.json`

The schema puts comment-closing text in both an object `description` and a property `description`:

- `*/` for C-style block comments
- `-}` for Elm/Haskell comments
- `"""` for Python/Elixir docstrings
- `\r}` for line-comment outputs that do not split on carriage return

Run:

```bash
CPUs=1 QUICKTEST=true FIXTURE=schema-typescript npm test -- test/inputs/schema/comment-injection.schema
```

Expected after a fix: the generated TypeScript validates `comment-injection.1.json` and prints equivalent JSON.

Current result: the test fails before validation because `TopLevel.ts` is syntactically invalid; the schema `description` escapes the generated `/** ... */` comment.

## Schema fields that can reach comments

In JSON Schema input, `packages/quicktype-core/src/attributes/Description.ts` collects `description` into type and property-description attributes. Renderers then emit those attributes as documentation comments.

Observed comment sinks:

- schema/type `description` on objects/classes
- property `description` for object properties/fields
- `description` on enum schemas
- `description` on union schemas and other named types when a renderer emits docs for those named types

`title` is different in the inspected path: JSON Schema input uses it for type/top-level naming, not as raw documentation text. The generated JSON Schema renderer can output JSON `title` fields, but those are JSON string values, not source comments.

Other non-schema inputs can also supply descriptions or leading comments, but the reproduction here is limited to JSON Schema `description`.

## Potentially affected outputs and triggers

Outputs are affected when raw schema descriptions are placed into comments/docstrings without escaping that target's comment delimiter or line terminators.

- C-style doc comments `/** ... */`: TypeScript, Flow, Java, C (`cjson`), C++, PHP, Kotlin, Scala 3. Trigger with `*/`.
- Elm/Haskell doc comments `{-| ... -}`: Elm, Haskell. Trigger with `-}`.
- Triple-quoted docstrings: Python, Elixir. Trigger with `"""`.
- Line comments (`//`, `///`, `#`): C#, Go, Rust, Ruby, Swift, Objective-C, Dart, Pike, Crystal, and enum comments in TypeScript-Zod/TypeScript-Effect-Schema. Trigger with a carriage return (`\r`) because descriptions are split on `\n`, leaving raw CR in the generated source.

Plain JavaScript output did not emit the tested schema descriptions into model comments, so the object/property reproduction does not affect it the same way. TypeScript-Zod and TypeScript-Effect-Schema also did not emit the object/property descriptions from `comment-injection.schema`; they only emitted the enum description from `comment-injection-enum.schema`.

## Test cases added

- `test/inputs/schema/comment-injection.schema` covers object and property descriptions.
- `test/inputs/schema/comment-injection-enum.schema` covers enum descriptions via an enum-valued property.

The existing `JSONSchemaFixture` instances pick these samples up for schema-based language tests. Additional narrow `comment-injection-*` fixtures cover affected outputs that did not already have full schema fixtures: PHP and Objective-C use both samples; TypeScript-Zod and TypeScript-Effect-Schema use only the enum-description sample.

They are expected to fail for affected languages until comment escaping/sanitization is implemented.
