import { getBinanceFuturesIncomeHistory } from "../../providers/binance.adapter";
import { readStore } from "../../storage/store.repository";
import type { RealizedPnlResponse } from "./pnl.types";

const BANGKOK_TIME_ZONE = "Asia/Bangkok";
const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_LIMIT = 1000;

type IncomeRecord = Awaited<ReturnType<typeof getBinanceFuturesIncomeHistory>>[number];

function roundNumber(value: number): number {
  return Number(value.toFixed(8));
}

function getBangkokDateParts(date: Date): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");

  return { year, month, day };
}

function getBangkokDateStringFromTimestamp(timestamp: number): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date(timestamp));
}

function getBangkokDayRangeUtcMs(year: number, month: number, day: number): {
  startTime: number;
  endTime: number;
} {
  const utcMidnightForBangkokDay = Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1000;

  return {
    startTime: utcMidnightForBangkokDay,
    endTime: utcMidnightForBangkokDay + DAY_MS - 1,
  };
}

function getBangkokRangeForLastNDays(daysBack: number): {
  startTime: number;
  endTime: number;
} {
  const now = new Date();
  const today = getBangkokDateParts(now);

  const endRange = getBangkokDayRangeUtcMs(today.year, today.month, today.day);

  const startDate = new Date(Date.UTC(today.year, today.month - 1, today.day));
  startDate.setUTCDate(startDate.getUTCDate() - Math.max(daysBack - 1, 0));

  const startRange = getBangkokDayRangeUtcMs(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth() + 1,
    startDate.getUTCDate(),
  );

  return {
    startTime: startRange.startTime,
    endTime: endRange.endTime,
  };
}

async function fetchAllIncomePages(
  accountId: string,
  params: {
    incomeType: "REALIZED_PNL" | "FUNDING_FEE" | "COMMISSION";
    startTime: number;
    endTime: number;
  },
): Promise<IncomeRecord[]> {
  const all: IncomeRecord[] = [];
  let pageStartTime = params.startTime;

  while (pageStartTime <= params.endTime) {
    const page = await getBinanceFuturesIncomeHistory(accountId, {
      incomeType: params.incomeType,
      startTime: pageStartTime,
      endTime: params.endTime,
      limit: PAGE_LIMIT,
    });

    if (!Array.isArray(page) || page.length === 0) {
      break;
    }

    all.push(...page);

    if (page.length < PAGE_LIMIT) {
      break;
    }

    const maxTime = Math.max(...page.map((item) => item.time));
    if (!Number.isFinite(maxTime) || maxTime < pageStartTime) {
      break;
    }

    pageStartTime = maxTime + 1;
  }

  return all;
}

export async function getRealizedPnlData(daysBack = 30): Promise<RealizedPnlResponse> {
  const store = await readStore();

  const binanceAccounts = store.accounts.filter(
    (account) => account.source === "binance" && account.provider === "binance",
  );

  if (binanceAccounts.length === 0) {
    return {
      accountCount: 0,
      days: [],
    };
  }

  const { startTime, endTime } = getBangkokRangeForLastNDays(daysBack);

  const incomeArrays = await Promise.all(
    binanceAccounts.map(async (account) => {
      const [realized, funding, commission] = await Promise.all([
        fetchAllIncomePages(account.id, {
          incomeType: "REALIZED_PNL",
          startTime,
          endTime,
        }),
        fetchAllIncomePages(account.id, {
          incomeType: "FUNDING_FEE",
          startTime,
          endTime,
        }),
        fetchAllIncomePages(account.id, {
          incomeType: "COMMISSION",
          startTime,
          endTime,
        }),
      ]);

      return [...realized, ...funding, ...commission];
    }),
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
    const date = getBangkokDateStringFromTimestamp(item.time);
    const existing = byDate.get(date) ?? {
      realizedPnl: 0,
      fundingFee: 0,
      commission: 0,
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
        values.realizedPnl + values.fundingFee - values.commission,
      ),
    }));

  return {
    accountCount: binanceAccounts.length,
    days,
  };
}