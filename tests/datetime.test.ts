import { describe, expect, it } from "vitest";
import { dateTimeLocalToIso, dateTimeLocalValue, zonedDateKey } from "@/lib/datetime";

const timeZone = "Asia/Aden"; // UTC+3

describe("tenant date-time helpers", () => {
  it("converts a wall-clock datetime-local value to UTC", () => {
    expect(dateTimeLocalToIso("2026-11-25T07:30:15", timeZone)).toBe("2026-11-25T04:30:15.000Z");
  });

  it("formats an instant as a tenant wall-clock datetime-local value", () => {
    expect(dateTimeLocalValue(new Date("2026-11-25T04:30:15.000Z"), timeZone)).toBe("2026-11-25T07:30:15");
  });

  it("uses the tenant calendar date for day totals", () => {
    expect(zonedDateKey(new Date("2026-11-24T21:00:00.000Z"), timeZone)).toBe("2026-11-25");
  });
});
