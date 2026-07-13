import { describe, expect, test } from "vitest";

import {
    evaluate,
    evaluateFull,
    load,
} from "../../packages/quicktype-core/src/MarkovChain.js";

describe("Markov chain", () => {
    test("decodes the compact count tables", () => {
        const chain = load();

        expect(chain.contextIndexes).toHaveLength(65 ** 2);
        expect(chain.smallCounts).toHaveLength(1965 * 65);
        expect(chain.largeCounts).toHaveLength(1080 * 65);
        expect(chain.totals).toHaveLength(65 ** 2);
    });

    test("preserves inference scores", () => {
        const chain = load();
        const [probability, scores] = evaluateFull(chain, "contactInformation");

        expect(probability).toBe(0.13037515438557548);
        expect(scores).toEqual([
            0.24570647634955584, 0.0695517774343122, 0.12157766649506248,
            0.05013868789194404, 0.136300600937727, 0.0008256664307619722,
            0.2017126546146527, 0.09551724137931035, 0.1854898336414048,
            0.6048253422555099, 0.08917037257210797, 0.2571233188967404,
            0.22705461451074146, 0.3433357205379168, 0.2508035244243717,
            0.6134135379935006,
        ]);
        expect(evaluate(chain, "contactInformation")).toBe(probability);
    });

    test("treats non-corpus characters as unseen", () => {
        const chain = load();

        expect(evaluateFull(chain, "aébc")).toEqual([0.0001, [0.0001, 0.0001]]);
        expect(evaluate(chain, "id")).toBe(1);
    });
});
