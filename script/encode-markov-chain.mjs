#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";

const alphabet =
    " -0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
const base91Alphabet =
    "!#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}";

class BitWriter {
    bytes = [];
    current = 0;
    bitCount = 0;

    writeBit(bit) {
        this.current = (this.current << 1) | bit;
        this.bitCount++;
        if (this.bitCount === 8) {
            this.bytes.push(this.current);
            this.current = 0;
            this.bitCount = 0;
        }
    }

    writeGamma(value) {
        const exponent = Math.floor(Math.log2(value));
        for (let i = 0; i < exponent; i++) this.writeBit(0);
        for (let i = exponent; i >= 0; i--) {
            this.writeBit((value >> i) & 1);
        }
    }

    writeCount(value, riceBits) {
        this.writeGamma(((value - 1) >> riceBits) + 1);
        for (let i = riceBits - 1; i >= 0; i--) {
            this.writeBit(((value - 1) >> i) & 1);
        }
    }

    finish(contextCount, smallContextCount) {
        if (this.bitCount !== 0) {
            this.bytes.push(this.current << (8 - this.bitCount));
        }
        return Uint8Array.of(
            contextCount & 0xff,
            contextCount >> 8,
            smallContextCount & 0xff,
            smallContextCount >> 8,
            ...this.bytes,
        );
    }
}

function bestRiceBits(counts) {
    let bestBits = 0;
    let bestSize = Number.POSITIVE_INFINITY;
    for (let candidate = 0; candidate <= 7; candidate++) {
        let size = 0;
        for (const count of counts) {
            if (count === 0) continue;
            const quotient = ((count - 1) >> candidate) + 1;
            size += 2 * Math.floor(Math.log2(quotient)) + 1 + candidate;
        }
        if (size < bestSize) {
            bestSize = size;
            bestBits = candidate;
        }
    }
    return bestBits;
}

function encodeChain(chain) {
    if (chain.depth !== 3) {
        throw new Error(
            `Expected a depth-3 Markov chain, got depth ${chain.depth}`,
        );
    }

    const writer = new BitWriter();
    let contextCount = 0;
    let smallContextCount = 0;
    for (const first of alphabet) {
        const firstTrie = chain.trie.arr[first.charCodeAt(0)];
        for (const second of alphabet) {
            const context =
                firstTrie !== null && typeof firstTrie === "object"
                    ? firstTrie.arr[second.charCodeAt(0)]
                    : null;
            const isPresent = context !== null && typeof context === "object";
            writer.writeBit(isPresent ? 1 : 0);
            if (!isPresent) continue;

            contextCount++;
            const counts = Array.from(alphabet, (character) => {
                const count = context.arr[character.charCodeAt(0)];
                return typeof count === "number" ? count : 0;
            });
            const riceBits = bestRiceBits(counts);
            const isSmall = counts.every((count) => count <= 255);
            if (isSmall) smallContextCount++;
            writer.writeBit(isSmall ? 1 : 0);
            for (let bit = 2; bit >= 0; bit--) {
                writer.writeBit((riceBits >> bit) & 1);
            }
            for (const count of counts) writer.writeBit(count === 0 ? 0 : 1);
            for (const count of counts) {
                if (count !== 0) writer.writeCount(count, riceBits);
            }
        }
    }
    return writer.finish(contextCount, smallContextCount);
}

function encodeBase91(bytes) {
    let result = "";
    let bits = 0;
    let bitCount = 0;
    for (const byte of bytes) {
        bits |= byte << bitCount;
        bitCount += 8;
        if (bitCount <= 13) continue;

        let value = bits & 8191;
        if (value > 88) {
            bits >>= 13;
            bitCount -= 13;
        } else {
            value = bits & 16383;
            bits >>= 14;
            bitCount -= 14;
        }
        result +=
            base91Alphabet[value % 91] + base91Alphabet[Math.floor(value / 91)];
    }
    if (bitCount !== 0) {
        result += base91Alphabet[bits % 91];
        if (bitCount > 7 || bits > 90) {
            result += base91Alphabet[Math.floor(bits / 91)];
        }
    }
    return result;
}

const [, , inputPath, outputPath] = process.argv;
if (inputPath === undefined || outputPath === undefined) {
    throw new Error(
        "Usage: node script/encode-markov-chain.mjs INPUT.json OUTPUT.ts",
    );
}

const chainData = JSON.parse(readFileSync(inputPath, "utf8"));
const encoded = encodeBase91(encodeChain(chainData));
writeFileSync(
    outputPath,
    `export const encodedMarkovChain =\n    "${encoded}";\n`,
);
