# Repository conventions

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
