import * as fs from "fs";
import * as path from "path";

import { defined, exceptionToString } from "@glideapps/ts-necessities";
import { isNode } from "browser-or-node";
import isURL from "is-url";
import type { Readable } from "readable-stream";

import { messageError } from "../../Messages";
import { panic } from "../../support/Support";

import { getStream } from "./get-stream";

import { fetch } from "./$fetch";

interface HttpHeaders {
    [key: string]: string;
}

function parseHeaders(httpHeaders?: string[]): HttpHeaders {
    if (!Array.isArray(httpHeaders)) {
        return {};
    }

    return httpHeaders.reduce((result: HttpHeaders, httpHeader: string) => {
        if (httpHeader !== undefined && httpHeader.length > 0) {
            const split = httpHeader.indexOf(":");

            if (split < 0) {
                return panic(`Could not parse HTTP header "${httpHeader}".`);
            }

            const key = httpHeader.slice(0, split).trim();
            const value = httpHeader.slice(split + 1).trim();
            result[key] = value;
        }

        return result;
    }, {} as HttpHeaders);
}

// "file:" URIs come from JSONSchemaInput, which converts Windows absolute
// schema paths to them because they are not valid URIs (issue #2869). We
// don't use `url.fileURLToPath` because its result is platform-dependent:
// drive-letter URIs must also be readable on POSIX (as paths relative to the
// working directory), which is how the tests exercise this, and Node's fs
// accepts forward slashes on Windows anyway. The addresses were URI-decoded
// when they were normalized, so there's no percent-decoding to do here.
function filePathFromFileURI(fileURI: string): string {
    const path = fileURI.slice("file://".length);
    if (/^\/[A-Za-z]:\//.test(path)) {
        // Drive-letter path, e.g. "file:///C:/dir/x.json" -> "C:/dir/x.json"
        return path.slice(1);
    }

    if (!path.startsWith("/")) {
        // UNC path, e.g. "file://server/share/x.json" -> "//server/share/x.json"
        return `//${path}`;
    }

    return path;
}

function resolveSymbolicLink(filePath: string): string {
    if (!fs.lstatSync(filePath).isSymbolicLink()) {
        return filePath;
    }

    const linkPath = fs.readlinkSync(filePath);
    if (path.isAbsolute(linkPath)) {
        return linkPath;
    }
    return path.join(path.dirname(filePath), linkPath);
}

export async function readableFromFileOrURL(
    fileOrURL: string,
    httpHeaders?: string[],
): Promise<Readable> {
    try {
        if (fileOrURL.startsWith("file://")) {
            fileOrURL = filePathFromFileURI(fileOrURL);
        } else if (isURL(fileOrURL)) {
            const response = await fetch(fileOrURL, {
                headers: parseHeaders(httpHeaders),
            });

            return defined(response.body) as unknown as Readable;
        }

        if (isNode) {
            if (fileOrURL === "-") {
                // Cast node readable to isomorphic readable from readable-stream
                return process.stdin as unknown as Readable;
            }

            const filePath = resolveSymbolicLink(fileOrURL);
            if (fs.existsSync(filePath)) {
                // Cast node readable to isomorphic readable from readable-stream
                return fs.createReadStream(
                    filePath,
                    "utf8",
                ) as unknown as Readable;
            }
        }
    } catch (e) {
        return messageError("MiscReadError", {
            fileOrURL,
            message: exceptionToString(e),
        });
    }

    return messageError("DriverInputFileDoesNotExist", { filename: fileOrURL });
}

export async function readFromFileOrURL(
    fileOrURL: string,
    httpHeaders?: string[],
): Promise<string> {
    const readable = await readableFromFileOrURL(fileOrURL, httpHeaders);
    try {
        return await getStream(readable);
    } catch (e) {
        return messageError("MiscReadError", {
            fileOrURL,
            message: exceptionToString(e),
        });
    }
}
