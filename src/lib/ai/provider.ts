/**
 * Provider-agnostic AI interface. The built-in deterministic provider makes
 * recommendations from real ERP data; a remote provider can be added later
 * without changing callers.
 */
export type AIInsight = {
  kind: "OPPORTUNITY" | "RISK" | "ACTION";
  title: string;
  body: string;
  metric?: number;
  link?: string;
};

export interface AIProvider {
  readonly name: string;
  insights(input: AIInsightInput): Promise<AIInsight[]>;
}

export type AIInsightInput = {
  currency: string;
  summary: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    expenses: number;
    netProfit: number;
    rawStockValue: number;
    finishedStockValue: number;
    receivables: number;
    payables: number;
  };
  production: {
    batches: number;
    completed: number;
    completedQuantity: number;
    rejectedQuantity: number;
  };
  topProducts: { name: string; revenue: number; profit: number }[];
  lowStock: { name: string; current: number; minimum: number }[];
};

export class LocalInsightsProvider implements AIProvider {
  readonly name = "local-deterministic";

  async insights(input: AIInsightInput): Promise<AIInsight[]> {
    const result: AIInsight[] = [];
    const { summary, production, topProducts, lowStock } = input;

    if (summary.revenue > 0) {
      const margin = (summary.grossProfit / summary.revenue) * 100;
      result.push({
        kind: margin < 30 ? "RISK" : "OPPORTUNITY",
        title: margin < 30 ? "Gross margin is under pressure" : "Healthy gross margin",
        body: `Gross margin is ${margin.toFixed(1)}% of revenue. Review recipe costs and selling prices for the lowest-margin products.`,
        metric: Math.round(margin * 10) / 10,
        link: "/reports",
      });
    }
    if (summary.expenses > summary.grossProfit && summary.grossProfit > 0) {
      result.push({
        kind: "RISK",
        title: "Operating expenses exceed gross profit",
        body: "Expenses recorded in this period are higher than gross profit. Review the expense report before expanding production.",
        metric: summary.expenses - summary.grossProfit,
        link: "/expenses",
      });
    }
    if (lowStock.length > 0) {
      result.push({
        kind: "ACTION",
        title: `${lowStock.length} items below minimum stock`,
        body: `Prioritise replenishment for ${lowStock.slice(0, 3).map((item) => item.name).join(", ")}.`,
        metric: lowStock.length,
        link: "/inventory",
      });
    }
    if (production.batches > 0) {
      const rejectRate = production.completedQuantity + production.rejectedQuantity > 0
        ? (production.rejectedQuantity / (production.completedQuantity + production.rejectedQuantity)) * 100
        : 0;
      if (rejectRate > 3) {
        result.push({
          kind: "RISK",
          title: "Production rejection rate is elevated",
          body: `Rejected output is ${rejectRate.toFixed(1)}% of completed output. Inspect the quality logs and recipe consistency.`,
          metric: Math.round(rejectRate * 10) / 10,
          link: "/quality",
        });
      }
    }
    if (summary.receivables > 0) {
      result.push({
        kind: "ACTION",
        title: "Follow up on outstanding receivables",
        body: "Settle or follow up on open customer balances to protect cash flow.",
        metric: summary.receivables,
        link: "/reports",
      });
    }
    const weakest = [...topProducts].sort((a, b) => a.profit - b.profit)[0];
    if (weakest && weakest.profit <= 0) {
      result.push({
        kind: "ACTION",
        title: `Review pricing for ${weakest.name}`,
        body: "This top-selling product is currently loss-making after cost allocation.",
        metric: weakest.profit,
        link: "/recipes",
      });
    }
    return result.slice(0, 6);
  }
}

let activeProvider: AIProvider = new LocalInsightsProvider();

export function getAIProvider(): AIProvider {
  return activeProvider;
}

export function setAIProvider(provider: AIProvider): void {
  activeProvider = provider;
}
