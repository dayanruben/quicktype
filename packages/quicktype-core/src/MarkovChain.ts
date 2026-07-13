import { encodedMarkovChain } from "./EncodedMarkovChain.js";

const alphabet =
    " -0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
const alphabetSize = alphabet.length;
const base91Alphabet =
    "!#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}";
const unseenProbability = 0.0001;

function panic(message: string): never {
    throw new Error(message);
}

function assert(condition: boolean, message: string): asserts condition {
    if (!condition) panic(message);
}

const characterIndexes = new Int8Array(128).fill(-1);
for (let i = 0; i < alphabetSize; i++) {
    characterIndexes[alphabet.charCodeAt(i)] = i;
}

const base91Indexes = new Int8Array(128);
for (let i = 0; i < base91Alphabet.length; i++) {
    base91Indexes[base91Alphabet.charCodeAt(i)] = i;
}

// This must be null, not undefined, because we write it to JSON when training.
export type SubTrie = number | null | Trie;
export interface Trie {
    arr: SubTrie[];
    count: number;
}

export interface TrainingMarkovChain {
    depth: number;
    trie: Trie;
}

export interface MarkovChain {
    depth: 3;
    contextIndexes: Uint16Array;
    smallCounts: Uint8Array;
    largeCounts: Uint16Array;
    totals: Uint32Array;
}

class BitReader {
    private byte = 4;
    private bit = 7;

    public constructor(private readonly bytes: Uint8Array) {}

    public readBit(): number {
        const result = (this.bytes[this.byte] >> this.bit) & 1;
        this.bit--;
        if (this.bit < 0) {
            this.byte++;
            this.bit = 7;
        }
        return result;
    }

    private readGamma(): number {
        let exponent = 0;
        while (this.readBit() === 0) exponent++;
        let value = 1;
        for (let i = 0; i < exponent; i++) {
            value = (value << 1) | this.readBit();
        }
        return value;
    }

    public readCount(riceBits: number): number {
        const high = (this.readGamma() - 1) << riceBits;
        let low = 0;
        for (let i = 0; i < riceBits; i++) {
            low = (low << 1) | this.readBit();
        }
        return high + low + 1;
    }
}

function decodeBase91(encoded: string): Uint8Array {
    const bytes = new Uint8Array(Math.ceil((encoded.length * 14) / 16));
    let output = 0;
    let value = -1;
    let bits = 0;
    let bitCount = 0;

    for (let i = 0; i < encoded.length; i++) {
        const digit = base91Indexes[encoded.charCodeAt(i)];
        if (value < 0) {
            value = digit;
            continue;
        }

        value += digit * 91;
        bits |= value << bitCount;
        bitCount += (value & 8191) > 88 ? 13 : 14;
        while (bitCount >= 8) {
            bytes[output++] = bits & 0xff;
            bits >>= 8;
            bitCount -= 8;
        }
        value = -1;
    }
    if (value >= 0) {
        bytes[output++] = (bits | (value << bitCount)) & 0xff;
    }
    return bytes.subarray(0, output);
}

function decode(encoded: string): MarkovChain {
    const bytes = decodeBase91(encoded);
    const contextCount = bytes[0] | (bytes[1] << 8);
    const smallContextCount = bytes[2] | (bytes[3] << 8);
    const largeContextCount = contextCount - smallContextCount;
    const contextIndexes = new Uint16Array(alphabetSize ** 2);
    const smallCounts = new Uint8Array((smallContextCount + 1) * alphabetSize);
    const largeCounts = new Uint16Array((largeContextCount + 1) * alphabetSize);
    const totals = new Uint32Array(alphabetSize ** 2);
    const present = new Uint8Array(alphabetSize);
    const reader = new BitReader(bytes);
    let smallContext = 0;
    let largeContext = 0;

    for (let prefix = 0; prefix < contextIndexes.length; prefix++) {
        if (reader.readBit() === 0) continue;

        const isSmall = reader.readBit() !== 0;
        const context = isSmall ? ++smallContext : ++largeContext;
        contextIndexes[prefix] = isSmall ? context : 0x8000 | context;
        let riceBits = 0;
        for (let i = 0; i < 3; i++) {
            riceBits = (riceBits << 1) | reader.readBit();
        }
        for (let character = 0; character < alphabetSize; character++) {
            present[character] = reader.readBit();
        }

        const destination = isSmall ? smallCounts : largeCounts;
        const offset = context * alphabetSize;
        let total = 0;
        for (let character = 0; character < alphabetSize; character++) {
            if (present[character] === 0) continue;
            const count = reader.readCount(riceBits);
            destination[offset + character] = count;
            total += count;
        }
        totals[prefix] = total;
    }

    return { depth: 3, contextIndexes, smallCounts, largeCounts, totals };
}

function characterIndex(word: string, index: number): number {
    const code = word.charCodeAt(index);
    return code < 128 ? characterIndexes[code] : -1;
}

function makeTrie(): Trie {
    const arr: SubTrie[] = [];
    for (let i = 0; i < 128; i++) arr.push(null);
    return { count: 0, arr };
}

function increment(t: Trie, seq: string, i: number): void {
    let first = seq.charCodeAt(i);
    if (first >= 128) first = 0;

    if (i >= seq.length - 1) {
        let n = t.arr[first];
        if (n === null) {
            n = 0;
        } else if (typeof n === "object") {
            return panic("Malformed trie");
        }
        t.arr[first] = n + 1;
        t.count += 1;
        return;
    }

    let st = t.arr[first];
    if (st === null) {
        st = makeTrie();
        t.arr[first] = st;
    }
    if (typeof st !== "object") return panic("Malformed trie");
    increment(st, seq, i + 1);
}

export function train(lines: string[], depth: number): TrainingMarkovChain {
    const trie = makeTrie();
    for (const line of lines) {
        for (let i = depth; i <= line.length; i++) {
            increment(trie, line.slice(i - depth, i), 0);
        }
    }
    return { trie, depth };
}

export function load(): MarkovChain {
    return decode(encodedMarkovChain);
}

export function evaluateFull(
    mc: MarkovChain,
    word: string,
): [number, number[]] {
    if (word.length < mc.depth) return [1, []];

    const { contextIndexes, smallCounts, largeCounts, totals } = mc;
    let first = characterIndexes[word.charCodeAt(0)];
    let second = characterIndexes[word.charCodeAt(1)];
    let probability = 1;
    const scores: number[] = [];

    for (let i = 2; i < word.length; i++) {
        const third = characterIndexes[word.charCodeAt(i)];
        let score = unseenProbability;
        if (first >= 0 && second >= 0 && third >= 0) {
            const prefix = first * alphabetSize + second;
            const context = contextIndexes[prefix];
            const count =
                (context & 0x8000) === 0
                    ? smallCounts[context * alphabetSize + third]
                    : largeCounts[(context & 0x7fff) * alphabetSize + third];
            if (count !== 0) score = count / totals[prefix];
        }
        scores.push(score);
        probability *= score;
        first = second;
        second = third;
    }

    return [probability ** (1 / scores.length), scores];
}

export function evaluate(mc: MarkovChain, word: string): number {
    if (word.length < mc.depth) return 1;

    const { contextIndexes, smallCounts, largeCounts, totals } = mc;
    let first = characterIndexes[word.charCodeAt(0)];
    let second = characterIndexes[word.charCodeAt(1)];
    let probability = 1;

    for (let i = 2; i < word.length; i++) {
        const third = characterIndexes[word.charCodeAt(i)];
        let score = unseenProbability;
        if (first >= 0 && second >= 0 && third >= 0) {
            const prefix = first * alphabetSize + second;
            const context = contextIndexes[prefix];
            const count =
                (context & 0x8000) === 0
                    ? smallCounts[context * alphabetSize + third]
                    : largeCounts[(context & 0x7fff) * alphabetSize + third];
            if (count !== 0) score = count / totals[prefix];
        }
        probability *= score;
        first = second;
        second = third;
    }

    return probability ** (1 / (word.length - 2));
}

function randomInt(lower: number, upper: number): number {
    return lower + Math.floor(Math.random() * (upper - lower));
}

export function generate(
    mc: MarkovChain,
    state: string,
    unseenWeight: number,
): string {
    assert(
        state.length === mc.depth - 1,
        "State and chain length don't match up",
    );

    const first = characterIndex(state, 0);
    const second = characterIndex(state, 1);
    if (first < 0 || second < 0) {
        return String.fromCharCode(randomInt(32, 127));
    }
    const prefix = first * alphabetSize + second;
    const context = mc.contextIndexes[prefix];
    if (context === 0) return String.fromCharCode(randomInt(32, 127));

    const weights = new Array<number>(128);
    let total = 0;
    for (let code = 0; code < 128; code++) {
        const index = characterIndexes[code];
        const count =
            index < 0
                ? 0
                : (context & 0x8000) === 0
                  ? mc.smallCounts[context * alphabetSize + index]
                  : mc.largeCounts[(context & 0x7fff) * alphabetSize + index];
        const weight = count === 0 ? (code === 0 ? 0 : unseenWeight) : count;
        weights[code] = weight;
        total += weight;
    }

    const choice = randomInt(0, total);
    let sum = 0;
    for (let code = 0; code < weights.length; code++) {
        sum += weights[code];
        if (choice < sum) return String.fromCharCode(code);
    }
    return panic("We screwed up bookkeeping, or randomInt");
}

function testWord(mc: MarkovChain, word: string): void {
    console.log(`"${word}": ${evaluate(mc, word)}`);
}

export function test(): void {
    const mc = load();
    for (const word of [
        "url",
        "json",
        "my_property",
        "ordinary",
        "different",
        "189512",
        "2BTZIqw0ntH9MvilQ3ewNY",
        "0uBTNdNGb2OY5lou41iYL52LcDq2",
        "-KpqHmWuDOUnr1hmAhxp",
        "granularity",
        "coverage",
        "postingFrequency",
        "dataFrequency",
        "units",
        "datasetOwner",
        "organization",
        "timePeriod",
        "contactInformation",
        "\ud83d\udebe \ud83c\udd92 \ud83c\udd93 \ud83c\udd95 \ud83c\udd96 \ud83c\udd97 \ud83c\udd99 \ud83c\udfe7",
    ]) {
        testWord(mc, word);
    }
}
