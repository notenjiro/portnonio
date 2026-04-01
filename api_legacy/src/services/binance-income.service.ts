import axios from "axios";

const BASE_URL = "https://fapi.binance.com";

export interface BinanceIncome {
  symbol: string;
  incomeType: string;
  income: string;
  asset: string;
  time: number;
}

function groupByDate(incomes: BinanceIncome[]) {
  const map = new Map<string, number>();

  for (const i of incomes) {
    if (i.incomeType !== "REALIZED_PNL") continue;

    const date = new Date(i.time).toISOString().slice(0, 10);
    const val = Number(i.income);

    map.set(date, (map.get(date) ?? 0) + val);
  }

  return map;
}

export async function fetchBinanceIncomeHistory(
  apiKey: string,
  startTime?: number,
  endTime?: number
) {
  const res = await axios.get(`${BASE_URL}/fapi/v1/income`, {
    headers: {
      "X-MBX-APIKEY": apiKey,
    },
    params: {
      incomeType: "REALIZED_PNL",
      startTime,
      endTime,
      limit: 1000,
    },
  });

  return res.data as BinanceIncome[];
}

export async function getDailyRealizedPnlMap(apiKey: string) {
  const incomes = await fetchBinanceIncomeHistory(apiKey);

  return groupByDate(incomes);
}