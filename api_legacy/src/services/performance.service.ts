import { listPortfolioSnapshots } from "./portfolio-snapshot.service.js";

function safePct(value: number, base: number) {
  if (!base || base === 0) return 0;
  return (value / base) * 100;
}

export function buildPerformanceSeries() {
  const snapshots: any[] = listPortfolioSnapshots();

  if (!snapshots || snapshots.length === 0) {
    return [];
  }

  const sorted = snapshots.sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const firstSnapshot = sorted[0];
  const firstValue = Number(firstSnapshot.totalValue ?? 0);

  let peakValue = firstValue;

  return sorted.map((curr: any, index: number) => {
    const prev = sorted[index - 1];

    const currValue = Number(curr.totalValue ?? 0);
    const prevValue = Number(prev?.totalValue ?? 0);

    const dailyChange = prev ? currValue - prevValue : 0;

    const dailyReturnPct = prev
      ? safePct(dailyChange, prevValue)
      : 0;

    const totalReturn = currValue - firstValue;

    if (currValue > peakValue) {
      peakValue = currValue;
    }

    const drawdown = currValue - peakValue;
    const drawdownPct = safePct(drawdown, peakValue);

    return {
      date: curr.date,
      totalValue: currValue,
      dailyReturnPct,
      totalReturn,
      drawdownPct,
    };
  });
}