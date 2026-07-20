# Repository conventions

## Testing

quicktype's primary testing method is end-to-end fixture tests driven by JSON
and JSON Schema files. For each sample input, the fixture generates code for a
language, runs a driver program in `test/fixtures/<language>/` that
deserializes the sample and serializes it back, and compares the round-tripped
JSON to the input.

- JSON inputs live in `test/inputs/json/`: `priority/` and `samples/` always
  run, `misc/` is skipped under `QUICKTEST` (and for languages with
  `skipMiscJSON`).
- JSON Schema inputs live in `test/inputs/schema/`: each `*.schema` comes with
  `.N.json` samples and `.N.fail.<feature>.json` expected-failure samples. A
  fail sample must make the generated program exit nonzero; which fail
  samples run is controlled by the language's `features` list.
- Every schema fixture test must have at least one positive (`.N.json`) and
  one negative (`.N.fail.<feature>.json`) test case, unless there is a very
  good reason not to.
- Per-language configuration — which inputs run (`skipJSON`, `includeJSON`,
  `skipSchema`), renderer options, and `features` — lives in
  `test/languages.ts`; fixtures are registered in `test/fixtures.ts`.
- Run one language's fixtures with `FIXTURE=<name> script/test`, for example
  `FIXTURE=php script/test` or `FIXTURE=schema-php script/test`.

Any change that affects generated output MUST be covered by a JSON or JSON
Schema fixture test — by enabling existing inputs for the language or adding
new ones. Unit tests in `test/unit/` are a complement for what fixtures cannot
express (asserting that some code is *not* generated, API-level behavior, fast
local iteration) — never a substitute.

## Releasing / version bumps

Do not bump versions in any `package.json` before a release. Package manifest
versions are intentionally allowed to be stale in the repository.

To publish, create a stable GitHub Release targeting the commit to release and
give it a tag in the form `vMAJOR.MINOR.PATCH`, for example `v24.0.0`. Publishing
the release triggers the npm and VS Code Marketplace workflows. They derive the
version exclusively from the release tag and stamp all manifests in the Actions
checkout before publishing; those changes are not committed.

The release version must be greater than every previous stable GitHub Release
and every version already published for the npm packages and VS Code extension.
Rerunning a partially completed release is safe: packages already published at
the exact release version are skipped.
