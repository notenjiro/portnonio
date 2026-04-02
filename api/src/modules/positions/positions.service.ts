import { getBinancePortfolio } from "../../providers/binance.adapter";
import { readStore } from "../../storage/store.repository";
import type {
  BinanceFuturesPosition,
  BinanceSpotHolding
} from "../../providers/provider.types";
import type { PositionsResponse } from "./positions.types";

function roundNumber(value: number): number {
  return Number(value.toFixed(8));
}

export async function getPositionsData(): Promise<PositionsResponse> {
  const store = await readStore();

  const binanceAccounts = store.accounts.filter(
    (account) => account.source === "binance" && account.provider === "binance"
  );

  if (binanceAccounts.length === 0) {
    return {
      asOf: null,
      spot: {
        items: [],
        count: 0,
        totalValueUsd: 0
      },
      futures: {
        items: [],
        count: 0,
        totalNotionalUsd: 0,
        totalUnrealizedPnl: 0
      }
    };
  }

  const portfolios = await Promise.all(
    binanceAccounts.map((account) => getBinancePortfolio(account.id))
  );

  const asOf =
    [...portfolios]
      .sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt))
      .at(-1)?.fetchedAt ?? null;

  const spotItems: BinanceSpotHolding[] = portfolios.flatMap(
    (portfolio) => portfolio.spot.holdings
  );

  const futuresItems: BinanceFuturesPosition[] = portfolios.flatMap(
    (portfolio) => portfolio.futures.positions
  );

  const totalSpotValueUsd = roundNumber(
    portfolios.reduce((sum, portfolio) => sum + portfolio.spot.totalValueUsd, 0)
  );

  const totalFuturesNotionalUsd = roundNumber(
    portfolios.reduce((sum, portfolio) => sum + portfolio.futures.totalNotionalUsd, 0)
  );

  const totalFuturesUnrealizedPnl = roundNumber(
    portfolios.reduce((sum, portfolio) => sum + portfolio.futures.totalUnrealizedPnl, 0)
  );

  return {
    asOf,
    spot: {
      items: spotItems,
      count: spotItems.length,
      totalValueUsd: totalSpotValueUsd
    },
    futures: {
      items: futuresItems,
      count: futuresItems.length,
      totalNotionalUsd: totalFuturesNotionalUsd,
      totalUnrealizedPnl: totalFuturesUnrealizedPnl
    }
  };
}