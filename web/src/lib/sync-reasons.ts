import type {
  MarketSyncItem,
  MarketSyncReasonCode,
  MarketSyncResult,
} from "@/lib/api";

export function getReasonLabel(reasonCode: MarketSyncReasonCode) {
  switch (reasonCode) {
    case "updated":
      return "Updated";
    case "inactive_asset":
      return "Inactive asset";
    case "manual_source":
      return "Manual source";
    case "source_mismatch":
      return "Different sync lane";
    case "not_due_yet":
      return "Not due yet";
    case "symbol_unsupported":
      return "Unsupported symbol";
    case "provider_error":
      return "Provider error";
    case "parse_failed":
      return "Parse failed";
    default:
      return "Other";
  }
}

function buildReasonCountMap(items: MarketSyncItem[]) {
  const map = new Map<MarketSyncReasonCode, number>();

  for (const item of items) {
    const current = map.get(item.reasonCode) ?? 0;
    map.set(item.reasonCode, current + 1);
  }

  return map;
}

export function getTopReasonSummary(
  result: MarketSyncResult,
  maxReasons = 2,
): string[] {
  const nonUpdatedItems = result.items.filter(
    (item) => item.reasonCode !== "updated",
  );

  if (nonUpdatedItems.length === 0) {
    return [];
  }

  const counts = buildReasonCountMap(nonUpdatedItems);

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxReasons)
    .map(([reasonCode, count]) => `${getReasonLabel(reasonCode)} ${count}`);
}

export function getMarketSyncToastText(result: MarketSyncResult) {
  const summary = `${result.updated} updated • ${result.skipped} skipped • ${result.failed} failed`;

  if (result.failed > 0) {
    const topReasons = getTopReasonSummary(result, 2);
    return {
      title: "Market sync completed with issues",
      description:
        topReasons.length > 0
          ? `${summary} • ${topReasons.join(" • ")}`
          : summary,
      tone: "info" as const,
    };
  }

  if (result.skipped > 0) {
    const skipItems = result.items.filter((item) => item.status === "skipped");
    const allNotDueYet =
      skipItems.length > 0 &&
      skipItems.every((item) => item.reasonCode === "not_due_yet");

    if (allNotDueYet && result.updated === 0) {
      return {
        title: "Nothing needed syncing",
        description: "All eligible assets are already up to date for now",
        tone: "info" as const,
      };
    }

    const topReasons = getTopReasonSummary(result, 2);

    return {
      title: "Market sync completed",
      description:
        topReasons.length > 0
          ? `${summary} • ${topReasons.join(" • ")}`
          : summary,
      tone: "success" as const,
    };
  }

  return {
    title: "Market sync completed",
    description: summary,
    tone: "success" as const,
  };
}