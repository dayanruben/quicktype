# JSON Schema comment injection

## TypeScript reproduction

Added a focused schema fixture:

- `test/inputs/schema/comment-injection.schema`
- `test/inputs/schema/comment-injection.1.json`

The schema puts comment-closing text in both an object `description` and a property `description`:

- `*/` for C-style block comments
- `{-` and `-}` for Elm/Haskell comments
- `"""` on its own line for Python/Elixir docstrings/heredocs
- `\r}` for line-comment outputs whose parsers treat carriage return as a line terminator

Run:

```bash
CPUs=1 QUICKTEST=true FIXTURE=schema-typescript npm test -- test/inputs/schema/comment-injection.schema
```

Expected result: the generated TypeScript validates `comment-injection.1.json` and prints equivalent JSON.

Before escaping was added, this test failed before validation because `TopLevel.ts` was syntactically invalid; the schema `description` escaped the generated `/** ... */` comment.

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

Outputs are affected when raw schema descriptions are placed into comments/docstrings without escaping that target's comment delimiter or line terminators. The shared fix now normalizes description line endings and escapes delimiter text at comment-emission time.

- C-style doc comments `/** ... */`: TypeScript, Flow, JavaScript when descriptions are emitted, Java, C (`cjson`), C++, PHP, Kotlin, Scala 3, Smithy4s. Trigger with `*/`; escaped as `* /`.
- Elm/Haskell doc comments `{-| ... -}`: Elm, Haskell. Trigger with `{-` or `-}`; escaped as `{ -` and `- }`.
- Triple-quoted docstrings/heredocs: Python, Elixir. Trigger with `"""` on its own description line; escaped as `\"\"\"`.
- Line comments (`//`, `///`): C#, Go, Rust, Ruby, Swift, Objective-C, Dart, Pike, Crystal, and enum comments in TypeScript-Zod/TypeScript-Effect-Schema. Trigger with a carriage return (`\r`) when descriptions are split only on `\n`; fixed by normalizing `\r\n?` to `\n` before comment emission.

Plain JavaScript output did not emit the tested schema descriptions into model comments, so the object/property reproduction does not affect it the same way. TypeScript-Zod and TypeScript-Effect-Schema also did not emit the object/property descriptions from `comment-injection.schema`; they only emitted the enum description from `comment-injection-enum.schema`.

The tree-sitter fixture includes Go, Rust, and Ruby even though their grammars did not reproduce a syntax break with the CR line-comment payload; this keeps parser coverage in place for those generated outputs and future payload/escaping changes.

Still not covered by the tree-sitter fixture: Swift, Objective-C, Dart, Pike, Crystal, Elixir, Kotlin, and Elm. Swift/Objective-C/Dart/Pike/Crystal/Elixir need compiler/toolchain or better grammar coverage for this bug class. Kotlin and Elm are affected by block-comment-style delimiters, but the available npm grammars were not usable with the WASM tree-sitter test added here.

## Test cases added

- `test/inputs/schema/comment-injection.schema` covers object and property descriptions.
- `test/inputs/schema/comment-injection-enum.schema` covers enum descriptions via an enum-valued property.

The existing `JSONSchemaFixture` instances pick these samples up for schema-based language tests. Additional narrow `comment-injection-*` fixtures cover affected outputs that did not already have full schema fixtures: Objective-C uses both samples; TypeScript-Zod and TypeScript-Effect-Schema use only the enum-description sample.

A parser-only fixture, `comment-injection-treesitter`, generates all configured targets and parses them with tree-sitter WASM grammars. It currently covers TypeScript, TypeScript-Zod, TypeScript-Effect-Schema, C#, Java, C (`cjson`), C++, PHP, Go, Rust, Ruby, Python, Scala 3, and Haskell. It is intentionally one fixture/test that loops over all configured languages and reports all parse failures together.

These are regression tests and should pass with the shared comment escaping/sanitization in place.
