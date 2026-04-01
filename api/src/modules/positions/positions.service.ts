import { getBinancePortfolio } from "../../providers/binance.adapter";
import { readStore } from "../../storage/store.repository";
import type { PositionsResponse } from "./positions.types";

export async function getPositionsData(): Promise<PositionsResponse> {
  const store = await readStore();

  const latestBinanceAccount = store.accounts.find(
    (account) => account.source === "binance" && account.provider === "binance"
  );

  if (!latestBinanceAccount) {
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

  const portfolio = await getBinancePortfolio(latestBinanceAccount.id);

  return {
    asOf: portfolio.fetchedAt,
    spot: {
      items: portfolio.spot.holdings,
      count: portfolio.spot.holdings.length,
      totalValueUsd: portfolio.spot.totalValueUsd
    },
    futures: {
      items: portfolio.futures.positions,
      count: portfolio.futures.positionCount,
      totalNotionalUsd: portfolio.futures.totalNotionalUsd,
      totalUnrealizedPnl: portfolio.futures.totalUnrealizedPnl
    }
  };
}