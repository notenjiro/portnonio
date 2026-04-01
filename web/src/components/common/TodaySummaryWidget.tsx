import { formatMoney, formatSignedMoney } from "@/lib/format"

type Props = {
  totalValue: number
  todayPnL: number
  futuresPnL: number
  stockValue: number
  fundValue: number
  cashBalance: number
  spotValue: number
  futuresWallet: number
}

function getTone(value: number) {
  if (value > 0) return "text-emerald-600 dark:text-emerald-400"
  if (value < 0) return "text-rose-600 dark:text-rose-400"
  return "text-foreground"
}

export default function TodaySummaryWidget({
  totalValue,
  todayPnL,
  futuresPnL,
  stockValue,
  fundValue,
  cashBalance,
  spotValue,
  futuresWallet,
}: Props) {
  const investedNonCrypto = stockValue + fundValue + cashBalance
  const trackedCrypto = spotValue + futuresWallet

  return (
    <section className="rounded-2xl border p-4 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Today Summary
          </p>
          <p className={`mt-1 text-2xl font-bold tracking-tight ${getTone(todayPnL)}`}>
            {formatSignedMoney(todayPnL)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Live view of your monitored portfolio
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border bg-muted/30 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Total
            </p>
            <p className="mt-1 font-semibold">{formatMoney(totalValue)}</p>
          </div>

          <div className="rounded-xl border bg-muted/30 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Futures P/L
            </p>
            <p className={`mt-1 font-semibold ${getTone(futuresPnL)}`}>
              {formatSignedMoney(futuresPnL)}
            </p>
          </div>

          <div className="rounded-xl border bg-muted/30 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Crypto
            </p>
            <p className="mt-1 font-semibold">{formatMoney(trackedCrypto)}</p>
          </div>

          <div className="rounded-xl border bg-muted/30 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Non-Crypto
            </p>
            <p className="mt-1 font-semibold">{formatMoney(investedNonCrypto)}</p>
          </div>
        </div>
      </div>
    </section>
  )
}