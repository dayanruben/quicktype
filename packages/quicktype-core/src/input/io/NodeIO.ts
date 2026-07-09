import * as fs from "fs";
import * as path from "path";

import { defined, exceptionToString } from "@glideapps/ts-necessities";
import { isNode } from "browser-or-node";
import isURL from "is-url";
import { Readable } from "readable-stream";

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

// Minimal structural type for a WHATWG ReadableStream — our TS lib doesn't
// include "dom", and on Node we only get the type via undici's fetch.
interface WebReadableStream {
    getReader: () => {
        read: () => Promise<{ done: boolean; value?: Uint8Array }>;
        releaseLock: () => void;
    };
}

async function* webStreamChunks(
    stream: WebReadableStream,
): AsyncGenerator<Uint8Array> {
    const reader = stream.getReader();
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) return;
            yield defined(value);
        }
    } finally {
        reader.releaseLock();
    }
}

// readable-stream implements Readable.from (it can't do Readable.fromWeb),
// but @types/readable-stream doesn't declare it, hence this cast.
const ReadableWithFrom = Readable as unknown as {
    from: (
        iterable: AsyncIterable<Uint8Array>,
        options: { objectMode: boolean },
    ) => Readable;
};

function readableFromResponseBody(body: unknown): Readable {
    // Native fetch (Node >= 18, browsers) returns a WHATWG ReadableStream,
    // which lacks the Node stream API that our consumers rely on, so we have
    // to wrap it.  The cross-fetch fallback (node-fetch) already returns a
    // Node stream, which we pass through unchanged.
    if (typeof (body as WebReadableStream).getReader === "function") {
        return ReadableWithFrom.from(
            webStreamChunks(body as WebReadableStream),
            { objectMode: false },
        );
    }

    return body as Readable;
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

            return readableFromResponseBody(defined(response.body));
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
