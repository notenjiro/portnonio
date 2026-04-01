import { getBinanceSyncReadiness } from "../../providers/binance.adapter";
import type { BinanceSyncSummary } from "./sync.types";

export async function runBinanceSync(accountId: string): Promise<BinanceSyncSummary> {
  const startedAt = new Date().toISOString();
  const readiness = await getBinanceSyncReadiness(accountId);
  const finishedAt = new Date().toISOString();

  if (!readiness.ready) {
    return {
      accountId,
      provider: "binance",
      startedAt,
      finishedAt,
      ready: false,
      simulated: true,
      message: readiness.reasons.join(", ") || "Binance account is not ready",
      recordsPlanned: 0
    };
  }

  return {
    accountId,
    provider: "binance",
    startedAt,
    finishedAt,
    ready: true,
    simulated: true,
    message: "Binance sync simulation is ready for implementation",
    recordsPlanned: 365
  };
}