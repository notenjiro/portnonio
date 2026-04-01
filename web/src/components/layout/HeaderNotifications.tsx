import { useMemo, useState } from "react";
import { Bell } from "lucide-react";

import type { AlertItem } from "@/types/dashboard";

type Props = {
  alerts: AlertItem[];
  lastUpdated: Date | null;
};

function formatLastUpdated(value: Date | null) {
  if (!value) return "Waiting for live update";

  return `Live update ${value.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}`;
}

function severityClasses(level: AlertItem["level"]) {
  if (level === "high") {
    return {
      badge:
        "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
      dot: "bg-red-500",
      card: "border-red-200 bg-red-50/50 dark:border-red-500/30 dark:bg-red-500/10",
      label: "High",
    };
  }

  return {
    badge:
      "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30",
    dot: "bg-yellow-500",
    card: "border-yellow-200 bg-yellow-50/50 dark:border-yellow-500/30 dark:bg-yellow-500/10",
    label: "Medium",
  };
}

export default function HeaderNotifications({ alerts, lastUpdated }: Props) {
  const [open, setOpen] = useState(false);

  const highCount = useMemo(
    () => alerts.filter((item) => item.level === "high").length,
    [alerts],
  );

  const mediumCount = useMemo(
    () => alerts.filter((item) => item.level === "medium").length,
    [alerts],
  );

  const badgeTone =
    highCount > 0
      ? "bg-red-500 text-white"
      : mediumCount > 0
        ? "bg-yellow-500 text-black"
        : "bg-muted text-muted-foreground";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border bg-background transition hover:bg-muted"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />

        {alerts.length > 0 ? (
          <span
            className={`absolute -right-1 -top-1 inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${badgeTone}`}
          >
            {alerts.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 z-40 mt-3 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-background shadow-xl">
            <div className="border-b px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Alerts</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatLastUpdated(lastUpdated)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {highCount > 0 ? (
                    <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700">
                      {highCount} High
                    </span>
                  ) : null}

                  {mediumCount > 0 ? (
                    <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-1 text-[11px] font-medium text-yellow-700">
                      {mediumCount} Medium
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto p-3">
              {alerts.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-5 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border bg-muted">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No active alerts</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The dashboard is quiet right now. No risk signals need your
                    attention.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert, index) => {
                    const tone = severityClasses(alert.level);

                    return (
                      <div
                        key={`${alert.level}-${alert.title}-${index}`}
                        className={`rounded-2xl border p-4 ${tone.card}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${tone.dot}`}
                            />
                            <div>
                              <p className="text-sm font-semibold">
                                {alert.title}
                              </p>
                              <p className="mt-1 text-sm text-foreground/80 dark:text-foreground/70">
                                {alert.detail}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${tone.badge}`}
                          >
                            {tone.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
