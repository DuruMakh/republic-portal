import { describe, expect, it } from "vitest";
import { rankDelegates } from "./ranking";

const d = (first: string, last: string, sup: number) => ({
  first_name: first,
  last_name: last,
  active_supporters: sup,
});

describe("rankDelegates", () => {
  it("orders by active supporters descending and assigns 1-based ranks", () => {
    const ranked = rankDelegates([d("ეკა", "მელაძე", 98), d("გიორგი", "მაისურაძე", 342)]);
    expect(ranked.map((r) => [r.first_name, r.rank])).toEqual([
      ["გიორგი", 1],
      ["ეკა", 2],
    ]);
  });
  it("breaks ties by Georgian collation of the full name", () => {
    const ranked = rankDelegates([d("ბექა", "ბერიძე", 50), d("ანა", "ბერიძე", 50)]);
    expect(ranked[0]?.first_name).toBe("ანა");
    expect(ranked[1]?.first_name).toBe("ბექა");
  });
  it("does not mutate its input", () => {
    const input = [d("ა", "ა", 1), d("ბ", "ბ", 2)];
    const copy = structuredClone(input);
    rankDelegates(input);
    expect(input).toEqual(copy);
  });
});
