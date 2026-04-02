import { getBinanceFuturesIncomeHistory } from "../../providers/binance.adapter";
import { readStore } from "../../storage/store.repository";
import type { RealizedPnlResponse } from "./pnl.types";

function roundNumber(value: number): number {
  return Number(value.toFixed(8));
}

function toDateString(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export async function getRealizedPnlData(daysBack = 30): Promise<RealizedPnlResponse> {
  const store = await readStore();

  const binanceAccounts = store.accounts.filter(
    (account) => account.source === "binance" && account.provider === "binance"
  );

  if (binanceAccounts.length === 0) {
    return {
      accountCount: 0,
      days: []
    };
  }

  const endTime = Date.now();
  const startTime = endTime - daysBack * 24 * 60 * 60 * 1000;

  const incomeArrays = await Promise.all(
    binanceAccounts.map(async (account) => {
      const [realized, funding, commission] = await Promise.all([
        getBinanceFuturesIncomeHistory(account.id, {
          incomeType: "REALIZED_PNL",
          startTime,
          endTime,
          limit: 1000
        }),
        getBinanceFuturesIncomeHistory(account.id, {
          incomeType: "FUNDING_FEE",
          startTime,
          endTime,
          limit: 1000
        }),
        getBinanceFuturesIncomeHistory(account.id, {
          incomeType: "COMMISSION",
          startTime,
          endTime,
          limit: 1000
        })
      ]);

      return [...realized, ...funding, ...commission];
    })
  );

  const allIncome = incomeArrays.flat();

  const byDate = new Map<
    string,
    {
      realizedPnl: number;
      fundingFee: number;
      commission: number;
    }
  >();

  for (const item of allIncome) {
    const date = toDateString(item.time);
    const existing = byDate.get(date) ?? {
      realizedPnl: 0,
      fundingFee: 0,
      commission: 0
    };

    if (item.incomeType === "REALIZED_PNL") {
      existing.realizedPnl += item.income;
    } else if (item.incomeType === "FUNDING_FEE") {
      existing.fundingFee += item.income;
    } else if (item.incomeType === "COMMISSION") {
      existing.commission += Math.abs(item.income);
    }

    byDate.set(date, existing);
  }

  const days = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, values]) => ({
      date,
      realizedPnl: roundNumber(values.realizedPnl),
      fundingFee: roundNumber(values.fundingFee),
      commission: roundNumber(values.commission),
      netRealizedPnl: roundNumber(
        values.realizedPnl + values.fundingFee - values.commission
      )
    }));

  return {
    accountCount: binanceAccounts.length,
    days
  };
}