# AGENTS.md

Notes for coding agents working in this repository.

## Environment

- This is a TypeScript/npm monorepo using npm workspaces.
- Prefer the Node version from `.nvmrc` (`nvm use`; currently Node 24.6.0). Published packages support Node >= 20.
- Install dependencies with `npm ci`.

## Build and run

- Build everything with:

  ```bash
  npm run build
  ```

  This runs `npm run clean`, builds all workspaces that have a `build` script, then runs the root `tsc`.

- After building, the CLI entry point is `dist/index.js`, for example:

  ```bash
  node dist/index.js --version
  node dist/index.js --help
  ```

- For live rebuild/re-run while developing renderer output, use `npm start -- "<quicktype args>"`.

## Tests

- Vitest runs the standalone unit and regression tests:

  ```bash
  npm run test:unit
  npm run test:unit:watch
  ```

- The cross-language fixture runner remains `script/test`, exposed as:

  ```bash
  npm run test:fixtures
  ```

- `npm test` runs the Vitest suite followed by the fixture suite.

- The full suite runs all fixtures and needs external language toolchains for many targets (`dotnet`, Java/Maven, Go, Rust, Python/mypy, PHP, Ruby, Kotlin, Scala, Elixir, etc.). On a machine without those tools, plain `npm test` will fail when it reaches the first missing toolchain.

- For local focused testing, use fixture filters. Fixture names are in `test/languages.ts` and `test/fixtures.ts`; comma-separated fixture groups are supported:

  ```bash
  QUICKTEST=true FIXTURE=javascript npm run test:fixtures
  QUICKTEST=true FIXTURE=typescript npm run test:fixtures -- test/inputs/json/samples/pokedex.json
  CPUs=2 QUICKTEST=true FIXTURE=javascript npm run test:fixtures
  ```

  `QUICKTEST=true` skips the large miscellaneous JSON input set. Extra arguments after `--` are sample files or directories to run.

- GitHub Actions uses the same pattern, e.g. `QUICKTEST=true FIXTURE=${{ matrix.fixture }} npm run test:fixtures`, after installing toolchain dependencies for each fixture group in `.github/workflows/test-pr.yaml`.

## Validation performed

The following commands were run successfully in this workspace:

```bash
npm ci
npm run build
node dist/index.js --version
CPUs=2 QUICKTEST=true FIXTURE=javascript npm run test:fixtures
QUICKTEST=true FIXTURE=typescript npm run test:fixtures -- test/inputs/json/samples/pokedex.json
```

Also observed: `npm test` without fixture filters started the full 70-fixture suite and failed on this machine because `dotnet` is not installed. `npm run lint` currently fails because ESLint cannot find a configuration file.
