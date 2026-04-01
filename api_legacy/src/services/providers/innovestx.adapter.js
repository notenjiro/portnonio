import { getInnovestXPortfolio, summarizeInnovestXPortfolio, } from "../innovestx.service.js";
function mapStockHoldings(portfolio) {
    return portfolio.stocks.map((item) => ({
        symbol: item.symbol,
        name: item.name,
        quantity: item.quantity,
        averageCost: item.averageCost,
        lastPrice: item.lastPrice,
        marketValue: item.marketValue,
        costValue: item.costValue,
        unrealizedPnL: item.unrealizedPnL,
    }));
}
function mapFundHoldings(portfolio) {
    return portfolio.funds.map((item) => ({
        symbol: item.symbol,
        name: item.name,
        units: item.units,
        nav: item.nav,
        marketValue: item.marketValue,
        costValue: item.costValue,
        unrealizedPnL: item.unrealizedPnL,
    }));
}
export class InnovestXProviderAdapter {
    provider = "innovestx";
    async getSummary(credentials) {
        const portfolio = await getInnovestXPortfolio(credentials.apiKey, credentials.apiSecret);
        const summary = summarizeInnovestXPortfolio(portfolio);
        return {
            totalValue: summary.totalValue,
            spotValue: 0,
            futuresWallet: 0,
            futuresUnrealizedPnL: 0,
            stockValue: summary.stockValue,
            fundValue: summary.fundValue,
            cashBalance: summary.cashBalance,
        };
    }
    async getBreakdown(credentials) {
        const portfolio = await getInnovestXPortfolio(credentials.apiKey, credentials.apiSecret);
        const summary = summarizeInnovestXPortfolio(portfolio);
        return {
            spotValue: 0,
            futuresWallet: 0,
            futuresPnL: 0,
            stockValue: summary.stockValue,
            fundValue: summary.fundValue,
            cashBalance: summary.cashBalance,
            spotHoldings: [],
            futuresPositions: [],
            stockHoldings: mapStockHoldings(portfolio),
            fundHoldings: mapFundHoldings(portfolio),
        };
    }
    async testConnection(credentials) {
        const portfolio = await getInnovestXPortfolio(credentials.apiKey, credentials.apiSecret);
        const [summary, breakdown] = await Promise.all([
            this.getSummary(credentials),
            this.getBreakdown(credentials),
        ]);
        return {
            success: true,
            accountNo: portfolio.accountNo,
            totalValue: summary.totalValue,
            summary,
            breakdown,
        };
    }
}
