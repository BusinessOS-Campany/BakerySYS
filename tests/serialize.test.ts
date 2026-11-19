import { describe, expect, it } from "vitest";
import { serialize } from "@/lib/serialize";

describe("serialize", () => {
  it("converts BigInt, Date and nested values into JSON-safe output", () => {
    const result = serialize({
      id: "entry-1",
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
      amount: 12,
      meta: { sequence: 10n, items: [1n, 2n] },
    });
    expect(result).toEqual({
      id: "entry-1",
      createdAt: "2026-01-02T03:04:05.000Z",
      amount: 12,
      meta: { sequence: 10, items: [1, 2] },
    });
  });
});
