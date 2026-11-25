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

  it("uses a selected day", () => {
    const { from, to } = getReportRange("day", timeZone, now, "2026-11-20");
    expect(from.toISOString()).toBe("2026-11-19T21:00:00.000Z");
    expect(to.toISOString()).toBe("2026-11-20T21:00:00.000Z");
  });

  it("uses the week containing the selected date", () => {
    const { from, to } = getReportRange("week", timeZone, now, "2026-11-18");
    expect(from.toISOString()).toBe("2026-11-15T21:00:00.000Z");
    expect(to.toISOString()).toBe("2026-11-22T21:00:00.000Z");
  });

  it("uses the month containing the selected date", () => {
    const { from, to } = getReportRange("month", timeZone, now, "2026-10-05");
    expect(from.toISOString()).toBe("2026-09-30T21:00:00.000Z");
    expect(to.toISOString()).toBe("2026-10-31T21:00:00.000Z");
  });

  it("accepts a date from an API request", () => {
    const { range } = resolveReportRange({ period: "day", date: "2026-11-20" }, timeZone);
    expect(range.from.toISOString()).toBe("2026-11-19T21:00:00.000Z");
  });
});
