import { describe, expect, it } from "vitest";
import { LocalInsightsProvider, setAIProvider, getAIProvider, type AIInsightInput } from "@/lib/ai/provider";

const baseInput: AIInsightInput = {
  currency: "SAR",
  summary: {
    revenue: 1000, cogs: 600, grossProfit: 400, expenses: 100, netProfit: 300,
    rawStockValue: 500, finishedStockValue: 200, receivables: 0, payables: 0,
  },
  topProducts: [{ name: "Croissant", revenue: 500, profit: 200 }],
  lowStock: [],
};

describe("AI provider", () => {
  it("returns deterministic insights from real ERP metrics", async () => {
    const provider = new LocalInsightsProvider();
    const first = await provider.insights(baseInput);
    const second = await provider.insights(baseInput);
    expect(first).toEqual(second);
    expect(first.some((insight) => insight.kind === "RISK" && insight.title.includes("margin"))).toBe(false);
    expect(first.every((insight) => typeof insight.title === "string" && insight.body.length > 0)).toBe(true);
  });

  it("flags low margin, low stock and receivables risks", async () => {
    const insights = await new LocalInsightsProvider().insights({
      ...baseInput,
      summary: { ...baseInput.summary, grossProfit: 100, receivables: 250 },
      lowStock: [{ name: "Flour", current: 2, minimum: 10 }],
      topProducts: [{ name: "Cake", revenue: 500, profit: -10 }],
    });
    expect(insights.map((insight) => insight.title)).toContain("Gross margin is under pressure");
    expect(insights.some((insight) => insight.title.includes("below minimum stock"))).toBe(true);
    expect(insights.some((insight) => insight.title.includes("receivables"))).toBe(true);
    expect(insights.some((insight) => insight.body.includes("loss-making"))).toBe(true);
  });

  it("supports provider replacement without touching callers", () => {
    const custom = { name: "stub", insights: async () => [] };
    setAIProvider(custom);
    expect(getAIProvider().name).toBe("stub");
    setAIProvider(new LocalInsightsProvider());
  });
});
