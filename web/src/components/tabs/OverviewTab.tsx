import AccountList from "@/components/accounts/AccountList"
import { pnlCardTone, pnlTextColor } from "@/lib/color"
import { formatMoney, formatSignedMoney } from "@/lib/format"

type Props = {
  futuresWallet: number
  futuresPnL: number
  stockValue: number
  fundValue: number
  cashBalance: number
  refreshKey: number
}

type AllocationItem = {
  key: string
  label: string
  value: number
  percent: number
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 100) return 100
  return value
}

function getAllocationItems(
  stockValue: number,
  fundValue: number,
  cashBalance: number,
  futuresWallet: number,
): AllocationItem[] {
  const items = [
    { key: "stocks", label: "Thai Stocks", value: stockValue },
    { key: "funds", label: "Funds", value: fundValue },
    { key: "cash", label: "Investable Cash", value: cashBalance },
    { key: "futures", label: "Futures Wallet", value: futuresWallet },
  ]

  const total = items.reduce((sum, item) => sum + item.value, 0)

  return items
    .filter((item) => item.value > 0)
    .map((item) => ({
      ...item,
      percent: total > 0 ? clampPercent((item.value / total) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value)
}

function getBarClass(index: number) {
  const classes = [
    "bg-foreground",
    "bg-emerald-500 dark:bg-emerald-400",
    "bg-yellow-500 dark:bg-yellow-400",
    "bg-blue-500 dark:bg-blue-400",
  ]

  return classes[index % classes.length]
}

export default function OverviewTab({
  futuresWallet,
  futuresPnL,
  stockValue,
  fundValue,
  cashBalance,
  refreshKey,
}: Props) {
  const lossPct =
    futuresWallet > 0 && futuresPnL < 0
      ? (Math.abs(futuresPnL) / futuresWallet) * 100
      : 0

  const riskStatus = lossPct >= 70 ? "High" : lossPct >= 40 ? "Medium" : "Low"

  const riskTextClass =
    riskStatus === "High"
      ? "text-rose-600 dark:text-rose-400"
      : riskStatus === "Medium"
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-emerald-600 dark:text-emerald-400"

  const riskBarClass =
    lossPct >= 70
      ? "bg-rose-500 dark:bg-rose-400"
      : lossPct >= 40
        ? "bg-yellow-500 dark:bg-yellow-400"
        : "bg-emerald-500 dark:bg-emerald-400"

  const allocationItems = getAllocationItems(
    stockValue,
    fundValue,
    cashBalance,
    futuresWallet,
  )

  const allocationTotal =
    stockValue + fundValue + cashBalance + futuresWallet

  return (
    <>
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border p-6 dark:border-white/10 dark:bg-white/[0.02]">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Risk Overview</h2>
              <p className="text-sm text-muted-foreground">
                Based on current unrealized loss relative to futures wallet
              </p>
            </div>

            <div className="text-left md:text-right">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className={`text-lg font-semibold ${riskTextClass}`}>
                {riskStatus}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className={`rounded-xl border p-4 ${pnlCardTone(-lossPct)}`}>
              <p className="text-sm text-muted-foreground">Unrealized Loss %</p>
              <p className={`mt-2 text-2xl font-semibold ${riskTextClass}`}>
                {lossPct.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
                %
              </p>
            </div>

            <div
              className={`rounded-xl border p-4 ${pnlCardTone(
                futuresWallet + futuresPnL,
              )}`}
            >
              <p className="text-sm text-muted-foreground">Wallet Buffer</p>
              <p
                className={`mt-2 text-2xl font-semibold ${pnlTextColor(
                  futuresWallet + futuresPnL,
                )}`}
              >
                {formatMoney(futuresWallet + futuresPnL)}
              </p>
            </div>

            <div className={`rounded-xl border p-4 ${pnlCardTone(futuresPnL)}`}>
              <p className="text-sm text-muted-foreground">
                Futures Unrealized P/L
              </p>
              <p
                className={`mt-2 text-2xl font-semibold ${pnlTextColor(
                  futuresPnL,
                )}`}
              >
                {formatSignedMoney(futuresPnL)}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Risk Exposure</p>
              <p className={`text-sm font-medium ${riskTextClass}`}>
                {riskStatus}
              </p>
            </div>

            <div className="h-3 w-full overflow-hidden rounded-full bg-muted dark:bg-white/10">
              <div
                className={`h-full rounded-full transition-all ${riskBarClass}`}
                style={{ width: `${Math.min(lossPct, 100)}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>40%</span>
              <span>70%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border p-6 dark:border-white/10 dark:bg-white/[0.02]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Portfolio Allocation</h2>
              <p className="text-sm text-muted-foreground">
                Current asset mix across monitored accounts
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs text-muted-foreground">Tracked Value</p>
              <p className="text-lg font-semibold">
                {formatMoney(allocationTotal)}
              </p>
            </div>
          </div>

          {allocationItems.length === 0 ? (
            <div className="rounded-xl border border-dashed p-5 dark:border-white/10 dark:bg-white/[0.02]">
              <p className="text-sm font-medium">No allocation data yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Connect Binance or InnovestX to build portfolio allocation.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {allocationItems.map((item, index) => (
                <div
                  key={item.key}
                  className="rounded-xl border p-4 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(item.value)}
                      </p>
                    </div>

                    <p className="text-sm font-semibold">
                      {item.percent.toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })}
                      %
                    </p>
                  </div>

                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted dark:bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${getBarClass(
                        index,
                      )}`}
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border p-6 dark:border-white/10 dark:bg-white/[0.02]">
        <h2 className="mb-4 text-xl font-semibold">Connected Accounts</h2>
        <AccountList refreshKey={refreshKey} />
      </section>
    </>
  )
}