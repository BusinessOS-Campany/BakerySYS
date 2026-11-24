import { describe, expect, it } from "vitest";
import { getReportRange, resolveReportRange } from "@/lib/reports/service";

// Asia/Aden is UTC+3, so local midnight is 21:00 UTC on the previous day.
const timeZone = "Asia/Aden";
const now = new Date("2026-11-24T10:30:00.000Z");

describe("report periods", () => {
  it("uses the tenant calendar day", () => {
    const { from, to } = getReportRange("day", timeZone, now);
    expect(from.toISOString()).toBe("2026-11-23T21:00:00.000Z");
    expect(to.toISOString()).toBe("2026-11-24T21:00:00.000Z");
  });

  it("starts the week on Monday", () => {
    const { from, to } = getReportRange("week", timeZone, now);
    expect(from.toISOString()).toBe("2026-11-22T21:00:00.000Z");
    expect(to.toISOString()).toBe("2026-11-29T21:00:00.000Z");
  });

  it("spans the current calendar month", () => {
    const { from, to } = getReportRange("month", timeZone, now);
    expect(from.toISOString()).toBe("2026-10-31T21:00:00.000Z");
    expect(to.toISOString()).toBe("2026-11-30T21:00:00.000Z");
  });

  it("keeps legacy rolling-day requests in range", () => {
    expect(resolveReportRange({ days: "400" }, timeZone).meta).toEqual({ period: "custom", days: 365 });
  });
});
