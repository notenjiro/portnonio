import { calculatePortfolioValue, getBinanceAccountInfo, getNonZeroBalances, getPrices, } from "../binance.service.js";
import { getBinanceFuturesAccountInfo, getBinanceFuturesPositions, getOpenFuturesPositions, summarizeFuturesAccount, } from "../binance-futures.service.js";
function mapSpotHoldings(balances, prices) {
    return balances
        .map((balance) => {
        const amount = Number(balance.free) + Number(balance.locked);
        if (amount === 0)
            return null;
        let value = 0;
        if (balance.asset === "USDT" || balance.asset === "FDUSD") {
            value = amount;
        }
        else {
            const usdtPair = `${balance.asset}USDT`;
            const fdusdPair = `${balance.asset}FDUSD`;
            const btcPair = `${balance.asset}BTC`;
            if (prices[usdtPair]) {
                value = amount * prices[usdtPair];
            }
            else if (prices[fdusdPair]) {
                value = amount * prices[fdusdPair];
            }
            else if (prices[btcPair] && prices["BTCUSDT"]) {
                value = amount * prices[btcPair] * prices["BTCUSDT"];
            }
        }
        return {
            asset: balance.asset,
            amount,
            value,
        };
    })
        .filter((item) => item !== null && Number.isFinite(item.value) && item.value > 0)
        .sort((a, b) => b.value - a.value);
}
function mapFuturesPositions(positions) {
    return positions
        .map((position) => {
        const side = Number(position.positionAmt) >= 0 ? "LONG" : "SHORT";
        return {
            symbol: position.symbol,
            side,
            size: Number(position.positionAmt),
            entryPrice: Number(position.entryPrice),
            markPrice: Number(position.markPrice),
            pnl: Number(position.unRealizedProfit),
            notional: Number(position.notional),
            leverage: Number(position.leverage),
        };
    })
        .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
}
export class BinanceProviderAdapter {
    provider = "binance";
    async getSummary(credentials) {
        const spotInfo = await getBinanceAccountInfo(credentials.apiKey, credentials.apiSecret);
        const spotBalances = getNonZeroBalances(spotInfo.balances);
        const prices = await getPrices();
        const spotValue = calculatePortfolioValue(spotBalances, prices);
        const futuresAccount = await getBinanceFuturesAccountInfo(credentials.apiKey, credentials.apiSecret);
        const futuresSummary = summarizeFuturesAccount(futuresAccount);
        return {
            totalValue: spotValue + futuresSummary.totalWalletBalance,
            spotValue,
            futuresWallet: futuresSummary.totalWalletBalance,
            futuresUnrealizedPnL: futuresSummary.totalUnrealizedProfit,
            stockValue: 0,
            fundValue: 0,
            cashBalance: 0,
        };
    }
    async getBreakdown(credentials) {
        const [spotInfo, prices, futuresAccount, futuresPositionsRaw] = await Promise.all([
            getBinanceAccountInfo(credentials.apiKey, credentials.apiSecret),
            getPrices(),
            getBinanceFuturesAccountInfo(credentials.apiKey, credentials.apiSecret),
            getBinanceFuturesPositions(credentials.apiKey, credentials.apiSecret),
        ]);
        const spotBalances = getNonZeroBalances(spotInfo.balances);
        const spotValue = calculatePortfolioValue(spotBalances, prices);
        const spotHoldings = mapSpotHoldings(spotBalances, prices);
        const futuresSummary = summarizeFuturesAccount(futuresAccount);
        const openPositions = getOpenFuturesPositions(futuresPositionsRaw);
        const futuresPositions = mapFuturesPositions(openPositions);
        return {
            spotValue,
            futuresWallet: futuresSummary.totalWalletBalance,
            futuresPnL: futuresSummary.totalUnrealizedProfit,
            stockValue: 0,
            fundValue: 0,
            cashBalance: 0,
            spotHoldings,
            futuresPositions,
            stockHoldings: [],
            fundHoldings: [],
        };
    }
    async testConnection(credentials) {
        const [summary, breakdown] = await Promise.all([
            this.getSummary(credentials),
            this.getBreakdown(credentials),
        ]);
        return {
            success: true,
            totalValue: summary.totalValue,
            summary,
            breakdown,
        };
    }
}
