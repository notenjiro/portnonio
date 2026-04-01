import { useEffect, useMemo, useState } from "react"

import { fetchAccountsBreakdown } from "@/lib/api"
import { formatMoney, formatSignedMoney } from "@/lib/format"
import type { AccountBreakdownItem } from "@/types/dashboard"

type MetricItem = {
  label: string
  value: string
  className?: string
}

type Props = {
  refreshKey?: number
}

function formatConnectedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getProviderStyle() {
  return {
    bg: "bg-gradient-to-r from-black via-[#0f0f0f] to-black",
    text: "text-[#F0B90B]",
    subText: "text-yellow-300/80",
    pill: "bg-[#F0B90B]/10 text-[#F0B90B] border-[#F0B90B]/20",
    line: "#F0B90B",
    fill: "rgba(240, 185, 11, 0.18)",
  }
}

function getMetrics(account: AccountBreakdownItem): MetricItem[] {
  return [
    {
      label: "Spot",
      value: formatMoney(account.spotValue),
    },
    {
      label: "Futures",
      value: formatMoney(account.futuresWallet),
    },
    {
      label: "PnL",
      value: formatSignedMoney(account.futuresPnL),
      className:
        account.futuresPnL > 0
          ? "text-green-400"
          : account.futuresPnL < 0
            ? "text-red-400"
            : "",
    },
  ]
}

function buildSparklineValues(account: AccountBreakdownItem) {
  const base = Math.max(account.totalValue, 1)

  return [
    Math.max(base * 0.72, 1),
    Math.max(account.spotValue * 0.8 + base * 0.08, 1),
    Math.max(account.spotValue + base * 0.04, 1),
    Math.max(account.futuresWallet * 0.76, 1),
    Math.max(account.futuresWallet + account.futuresPnL * 0.2, 1),
    Math.max(account.futuresWallet + account.futuresPnL * 0.45, 1),
    Math.max(account.totalValue, 1),
  ]
}

function Sparkline({
  values,
  line,
  fill,
}: {
  values: number[]
  line: string
  fill: string
}) {
  const width = 120
  const height = 34
  const padding = 2

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values.map((value, index) => {
    const x =
      padding +
      (index * (width - padding * 2)) / Math.max(values.length - 1, 1)
    const y =
      height - padding - ((value - min) / range) * (height - padding * 2)
    return { x, y }
  })

  const linePath = points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ")

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(height - padding).toFixed(2)} L ${points[0].x.toFixed(2)} ${(height - padding).toFixed(2)} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-9 w-[120px] shrink-0"
      aria-hidden="true"
    >
      <path d={areaPath} fill={fill} />
      <path
        d={linePath}
        fill="none"
        stroke={line}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function AccountList({ refreshKey = 0 }: Props) {
  const [accounts, setAccounts] = useState<AccountBreakdownItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true

    async function load() {
      const isFirstLoad = accounts.length === 0

      try {
        if (isFirstLoad) {
          setLoading(true)
        } else {
          setIsRefreshing(true)
        }

        setError("")

        const res = await fetchAccountsBreakdown()
        if (!mounted) return

        const nextAccounts = Array.isArray(res?.accounts)
          ? res.accounts.filter(
              (account: AccountBreakdownItem) => account.provider === "binance",
            )
          : []

        setAccounts(nextAccounts)
      } catch (err) {
        if (!mounted) return

        const message =
          err instanceof Error ? err.message : "Failed to load accounts"

        setError(message)
        if (isFirstLoad) {
          setAccounts([])
        }
      } finally {
        if (mounted) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [refreshKey])

  const sortedAccounts = useMemo(
    () =>
      [...accounts].sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime()
        const bTime = new Date(b.createdAt).getTime()
        return bTime - aTime
      }),
    [accounts],
  )

  if (loading) {
    return (
      <section className="rounded-2xl border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Connected Accounts</h2>
            <p className="text-sm text-muted-foreground">Loading accounts...</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="h-[156px] animate-pulse rounded-2xl border bg-muted/40"
            />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Connected Accounts</h2>
          <p className="text-sm text-muted-foreground">
            Live provider connections currently tracked in the dashboard
          </p>
        </div>

        {isRefreshing ? (
          <span className="text-xs text-muted-foreground">Refreshing...</span>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!error && sortedAccounts.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          No connected Binance accounts yet.
        </div>
      ) : null}

      {sortedAccounts.length > 0 ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {sortedAccounts.map((account) => {
            const style = getProviderStyle()
            const metrics = getMetrics(account)
            const sparklineValues = buildSparklineValues(account)

            return (
              <article
                key={account.id}
                className={`overflow-hidden rounded-2xl border ${style.bg} p-5 text-white shadow-sm`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={`text-lg font-semibold ${style.text}`}>
                        Binance
                      </h3>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${style.pill}`}
                      >
                        {account.provider}
                      </span>
                    </div>

                    <p className={`mt-1 text-xs ${style.subText}`}>
                      Connected at {formatConnectedAt(account.createdAt)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className={`text-[11px] uppercase tracking-wide ${style.subText}`}>
                      Total Value
                    </p>
                    <p className={`mt-1 text-xl font-semibold ${style.text}`}>
                      {formatMoney(account.totalValue)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-end justify-between gap-4">
                  <div className="grid flex-1 grid-cols-3 gap-2">
                    {metrics.map((metric) => (
                      <div
                        key={metric.label}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                      >
                        <p className="text-[11px] uppercase tracking-wide text-white/55">
                          {metric.label}
                        </p>
                        <p
                          className={`mt-1 text-sm font-medium text-white ${metric.className ?? ""}`}
                        >
                          {metric.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <Sparkline
                    values={sparklineValues}
                    line={style.line}
                    fill={style.fill}
                  />
                </div>
              </article>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}