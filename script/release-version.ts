#!/usr/bin/env ts-node

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as semver from "semver";

type PublishAction = "publish" | "skip";

interface PackageManifest {
    version: string;
    dependencies?: Record<string, string>;
}

interface GitHubRelease {
    id: number;
    tag_name: string;
    draft: boolean;
    prerelease: boolean;
}

interface MarketplaceMetadata {
    versions: Array<{ version: string }>;
}

const manifests = [
    "package.json",
    "packages/quicktype-core/package.json",
    "packages/quicktype-graphql-input/package.json",
    "packages/quicktype-typescript-input/package.json",
    "packages/quicktype-vscode/package.json",
];

const internalDependencies = new Set([
    "quicktype-core",
    "quicktype-graphql-input",
    "quicktype-typescript-input",
]);

export function parseReleaseTag(tag: string): string {
    if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag)) {
        throw new Error(
            `Release tag ${JSON.stringify(tag)} must have the form vMAJOR.MINOR.PATCH`,
        );
    }

    const version = tag.slice(1);
    if (semver.valid(version) !== version) {
        throw new Error(
            `Release tag ${JSON.stringify(tag)} is not valid SemVer`,
        );
    }
    return version;
}

function requireStableVersion(version: string): void {
    if (
        semver.valid(version) !== version ||
        semver.prerelease(version) !== null
    ) {
        throw new Error(
            `${JSON.stringify(version)} is not a stable SemVer version`,
        );
    }
}

export function publishAction(
    version: string,
    publishedVersions: readonly string[],
    target: string,
): PublishAction {
    requireStableVersion(version);
    const validVersions = publishedVersions.filter(
        (candidate) =>
            semver.valid(candidate) === candidate &&
            semver.prerelease(candidate) === null,
    );
    const newest = semver.rsort(validVersions)[0];

    if (newest !== undefined && semver.gt(newest, version)) {
        throw new Error(
            `${target} already has newer version ${newest}; refusing to publish ${version}`,
        );
    }
    if (validVersions.includes(version)) {
        return "skip";
    }
    return "publish";
}

export function stampManifests(root: string, version: string): void {
    requireStableVersion(version);

    for (const relativePath of manifests) {
        const path = join(root, relativePath);
        const manifest = JSON.parse(
            readFileSync(path, "utf8"),
        ) as PackageManifest;
        manifest.version = version;

        if (manifest.dependencies !== undefined) {
            for (const dependency of internalDependencies) {
                if (manifest.dependencies[dependency] !== undefined) {
                    manifest.dependencies[dependency] = version;
                }
            }
        }

        writeFileSync(path, `${JSON.stringify(manifest, undefined, 4)}\n`);
    }
}

export function validateAgainstPreviousReleases(
    version: string,
    currentReleaseId: number,
    releases: readonly GitHubRelease[],
): string | undefined {
    requireStableVersion(version);
    const previousVersions = releases
        .filter(
            (release) =>
                !release.draft &&
                !release.prerelease &&
                release.id !== currentReleaseId,
        )
        .map((release) => {
            try {
                return parseReleaseTag(release.tag_name);
            } catch {
                return undefined;
            }
        })
        .filter((candidate): candidate is string => candidate !== undefined);
    const newest = semver.rsort(previousVersions)[0];

    if (newest !== undefined && !semver.gt(version, newest)) {
        throw new Error(
            `Release version ${version} must be greater than previous release ${newest}`,
        );
    }
    return newest;
}

async function getGitHubReleases(
    repository: string,
    token: string,
): Promise<GitHubRelease[]> {
    const releases: GitHubRelease[] = [];
    for (let page = 1; ; page += 1) {
        const response = await fetch(
            `https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`,
            {
                headers: {
                    Accept: "application/vnd.github+json",
                    Authorization: `Bearer ${token}`,
                    "User-Agent": "quicktype-release-workflow",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            },
        );
        if (!response.ok) {
            throw new Error(
                `GitHub releases request failed: ${response.status} ${response.statusText}`,
            );
        }
        const pageOfReleases = (await response.json()) as GitHubRelease[];
        releases.push(...pageOfReleases);
        if (pageOfReleases.length < 100) {
            return releases;
        }
    }
}

function npmVersions(packageName: string): string[] {
    const output = execFileSync(
        "npm",
        ["view", packageName, "versions", "--json"],
        {
            encoding: "utf8",
        },
    );
    const parsed = JSON.parse(output) as string | string[];
    return Array.isArray(parsed) ? parsed : [parsed];
}

function marketplaceVersions(): string[] {
    const vsce = join(process.cwd(), "node_modules", ".bin", "vsce");
    const output = execFileSync(
        vsce,
        ["show", "quicktype.quicktype", "--json"],
        {
            encoding: "utf8",
            maxBuffer: 32 * 1024 * 1024,
        },
    );
    const metadata = JSON.parse(output) as MarketplaceMetadata;
    return metadata.versions.map((entry) => entry.version);
}

async function main(): Promise<void> {
    const [command, first, second] = process.argv.slice(2);

    switch (command) {
        case "validate": {
            if (first === undefined) {
                throw new Error("validate requires a release tag");
            }
            const version = parseReleaseTag(first);
            const repository = process.env.GITHUB_REPOSITORY;
            const token = process.env.GITHUB_TOKEN;
            const releaseId = Number(process.env.GITHUB_RELEASE_ID);
            if (
                repository === undefined ||
                token === undefined ||
                !Number.isSafeInteger(releaseId)
            ) {
                throw new Error(
                    "GitHub release validation environment is incomplete",
                );
            }
            const previous = validateAgainstPreviousReleases(
                version,
                releaseId,
                await getGitHubReleases(repository, token),
            );
            if (previous !== undefined) {
                console.error(
                    `* Release ${version} is newer than previous release ${previous}`,
                );
            }
            console.log(version);
            return;
        }
        case "stamp":
            if (first === undefined) {
                throw new Error("stamp requires a version");
            }
            stampManifests(process.cwd(), first);
            return;
        case "npm-action":
            if (first === undefined || second === undefined) {
                throw new Error(
                    "npm-action requires a package name and version",
                );
            }
            console.log(publishAction(second, npmVersions(first), first));
            return;
        case "marketplace-action":
            if (first === undefined) {
                throw new Error("marketplace-action requires a version");
            }
            console.log(
                publishAction(
                    first,
                    marketplaceVersions(),
                    "VS Code extension quicktype.quicktype",
                ),
            );
            return;
        default:
            throw new Error(
                "Usage: release-version.ts <validate|stamp|npm-action|marketplace-action> ...",
            );
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
