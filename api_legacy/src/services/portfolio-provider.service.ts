import type {
  ProviderBreakdown,
  ProviderName,
  ProviderSummary,
} from "./providers/provider.types.js";
import { getProviderAdapter } from "./providers/provider-registry.js";

export type PortfolioSummary = ProviderSummary;
export type PortfolioBreakdown = ProviderBreakdown;

export async function buildProviderSummary(
  provider: ProviderName,
  apiKey: string,
  apiSecret: string,
): Promise<PortfolioSummary> {
  const adapter = getProviderAdapter(provider);

  return adapter.getSummary({
    apiKey,
    apiSecret,
  });
}

export async function buildProviderBreakdown(
  provider: ProviderName,
  apiKey: string,
  apiSecret: string,
): Promise<PortfolioBreakdown> {
  const adapter = getProviderAdapter(provider);

  return adapter.getBreakdown({
    apiKey,
    apiSecret,
  });
}

export async function testProviderConnection(
  provider: ProviderName,
  apiKey: string,
  apiSecret: string,
) {
  const adapter = getProviderAdapter(provider);

  return adapter.testConnection({
    apiKey,
    apiSecret,
  });
}

export function mergePortfolioSummaries(
  ...summaries: Array<PortfolioSummary | null | undefined>
): PortfolioSummary {
  return summaries.reduce<PortfolioSummary>(
    (acc, summary) => {
      if (!summary) return acc;

      acc.totalValue += summary.totalValue;
      acc.spotValue += summary.spotValue;
      acc.futuresWallet += summary.futuresWallet;
      acc.futuresUnrealizedPnL += summary.futuresUnrealizedPnL;
      acc.stockValue += summary.stockValue;
      acc.fundValue += summary.fundValue;
      acc.cashBalance += summary.cashBalance;

      return acc;
    },
    {
      totalValue: 0,
      spotValue: 0,
      futuresWallet: 0,
      futuresUnrealizedPnL: 0,
      stockValue: 0,
      fundValue: 0,
      cashBalance: 0,
    },
  );
}

export function mergePortfolioBreakdowns(
  ...breakdowns: Array<PortfolioBreakdown | null | undefined>
): PortfolioBreakdown {
  return breakdowns.reduce<PortfolioBreakdown>(
    (acc, breakdown) => {
      if (!breakdown) return acc;

      acc.spotValue += breakdown.spotValue;
      acc.futuresWallet += breakdown.futuresWallet;
      acc.futuresPnL += breakdown.futuresPnL;
      acc.stockValue += breakdown.stockValue;
      acc.fundValue += breakdown.fundValue;
      acc.cashBalance += breakdown.cashBalance;
      acc.spotHoldings.push(...breakdown.spotHoldings);
      acc.futuresPositions.push(...breakdown.futuresPositions);
      acc.stockHoldings.push(...breakdown.stockHoldings);
      acc.fundHoldings.push(...breakdown.fundHoldings);

      return acc;
    },
    {
      spotValue: 0,
      futuresWallet: 0,
      futuresPnL: 0,
      stockValue: 0,
      fundValue: 0,
      cashBalance: 0,
      spotHoldings: [],
      futuresPositions: [],
      stockHoldings: [],
      fundHoldings: [],
    },
  );
}