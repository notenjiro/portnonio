import { getProviderAdapter } from "./providers/provider-registry.js";
export async function buildProviderSummary(provider, apiKey, apiSecret) {
    const adapter = getProviderAdapter(provider);
    return adapter.getSummary({
        apiKey,
        apiSecret,
    });
}
export async function buildProviderBreakdown(provider, apiKey, apiSecret) {
    const adapter = getProviderAdapter(provider);
    return adapter.getBreakdown({
        apiKey,
        apiSecret,
    });
}
export async function testProviderConnection(provider, apiKey, apiSecret) {
    const adapter = getProviderAdapter(provider);
    return adapter.testConnection({
        apiKey,
        apiSecret,
    });
}
export function mergePortfolioSummaries(...summaries) {
    return summaries.reduce((acc, summary) => {
        if (!summary)
            return acc;
        acc.totalValue += summary.totalValue;
        acc.spotValue += summary.spotValue;
        acc.futuresWallet += summary.futuresWallet;
        acc.futuresUnrealizedPnL += summary.futuresUnrealizedPnL;
        acc.stockValue += summary.stockValue;
        acc.fundValue += summary.fundValue;
        acc.cashBalance += summary.cashBalance;
        return acc;
    }, {
        totalValue: 0,
        spotValue: 0,
        futuresWallet: 0,
        futuresUnrealizedPnL: 0,
        stockValue: 0,
        fundValue: 0,
        cashBalance: 0,
    });
}
export function mergePortfolioBreakdowns(...breakdowns) {
    return breakdowns.reduce((acc, breakdown) => {
        if (!breakdown)
            return acc;
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
    }, {
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
    });
}
