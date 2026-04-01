import { listPortfolioSnapshots } from "./portfolio-snapshot.service.js";
function safePct(n, d) {
    if (!d || !Number.isFinite(d))
        return 0;
    return (n / d) * 100;
}
export function buildPerformanceSeries() {
    const snapshots = listPortfolioSnapshots();
    if (snapshots.length === 0) {
        return [];
    }
    const firstSnapshot = snapshots[0];
    if (!firstSnapshot) {
        return [];
    }
    const results = [];
    const firstValue = firstSnapshot.totalValue;
    let peakValue = firstValue;
    for (let i = 0; i < snapshots.length; i += 1) {
        const curr = snapshots[i];
        if (!curr) {
            continue;
        }
        const prev = i > 0 ? snapshots[i - 1] : undefined;
        const dailyChange = prev ? curr.totalValue - prev.totalValue : 0;
        const dailyReturnPct = prev
            ? safePct(dailyChange, prev.totalValue)
            : 0;
        const cumulativeReturnPct = safePct(curr.totalValue - firstValue, firstValue);
        if (curr.totalValue > peakValue) {
            peakValue = curr.totalValue;
        }
        const drawdownPct = safePct(curr.totalValue - peakValue, peakValue);
        results.push({
            date: curr.date,
            totalValue: curr.totalValue,
            dailyChange,
            dailyReturnPct,
            cumulativeReturnPct,
            drawdownPct,
        });
    }
    return results;
}
