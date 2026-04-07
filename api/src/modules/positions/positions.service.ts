import { getBinancePortfolio } from "../../providers/binance.adapter";
import { readStore } from "../../storage/store.repository";
import type {
  BinanceFuturesPosition,
  BinanceSpotHolding
} from "../../providers/provider.types";
import type { PositionsResponse } from "./positions.types";
import { convertAmount } from "../../services/fx-rate.service";

const BASE_CURRENCY = "THB";

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

  /**
   * 🟡 SPOT
   */
  const spotItems: BinanceSpotHolding[] = portfolios.flatMap(
    (portfolio) => portfolio.spot.holdings
  );

  /**
   * 🟣 FUTURES (🔥 เพิ่ม PnL normalize)
   */
  const futuresItemsRaw: BinanceFuturesPosition[] = portfolios.flatMap(
    (portfolio) => portfolio.futures.positions
  );

  const futuresItems = await Promise.all(
    futuresItemsRaw.map(async (pos) => {
      const unrealizedPnlTHB = await convertAmount(
        pos.unrealizedPnl,
        "USD",
        BASE_CURRENCY
      );

      const notionalTHB = await convertAmount(
        pos.notionalUsd,
        "USD",
        BASE_CURRENCY
      );

      return {
        ...pos,
        unrealizedPnlBase: roundNumber(unrealizedPnlTHB),
        notionalBase: roundNumber(notionalTHB),
        baseCurrency: BASE_CURRENCY
      };
    })
  );

  /**
   * 🟡 RAW USD TOTAL
   */
  const totalSpotValueUsdRaw = portfolios.reduce(
    (sum, portfolio) => sum + portfolio.spot.totalValueUsd,
    0
  );

  const totalFuturesNotionalUsdRaw = portfolios.reduce(
    (sum, portfolio) => sum + portfolio.futures.totalNotionalUsd,
    0
  );

  const totalFuturesUnrealizedPnlRaw = portfolios.reduce(
    (sum, portfolio) => sum + portfolio.futures.totalUnrealizedPnl,
    0
  );

  /**
   * 💱 CONVERT → THB
   */
  const totalSpotValueTHB = roundNumber(
    await convertAmount(totalSpotValueUsdRaw, "USD", BASE_CURRENCY)
  );

  const totalFuturesNotionalTHB = roundNumber(
    await convertAmount(totalFuturesNotionalUsdRaw, "USD", BASE_CURRENCY)
  );

  const totalFuturesUnrealizedPnlTHB = roundNumber(
    await convertAmount(totalFuturesUnrealizedPnlRaw, "USD", BASE_CURRENCY)
  );

  return {
    asOf,

    spot: {
      items: spotItems,
      count: spotItems.length,
      totalValueUsd: totalSpotValueTHB // 👈 ยังใช้ field เดิมไว้ก่อน
    },

    futures: {
      items: futuresItems, // 👈 มี field ใหม่เพิ่ม
      count: futuresItems.length,
      totalNotionalUsd: totalFuturesNotionalTHB,
      totalUnrealizedPnl: totalFuturesUnrealizedPnlTHB
    }
  };
}