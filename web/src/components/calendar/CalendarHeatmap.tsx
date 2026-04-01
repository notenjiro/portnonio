import { useEffect, useState } from "react"
import { fetchDailyPnL } from "@/lib/api"

type CalendarDay = {
  date: string
  net: number
  fundingFee: number
  commission: number
  realizedPnl: number
}

function getColor(value: number) {
  if (value > 0) return "bg-pnl-profit/20 text-pnl-profit"
  if (value < 0) return "bg-pnl-loss/20 text-pnl-loss"
  return "bg-muted text-muted-foreground"
}

function formatSignedCurrency(value: number) {
  if (!Number.isFinite(value)) return "$0"

  const sign = value >= 0 ? "+" : "-"
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`
}

export default function CalendarHeatmap() {
  const [data, setData] = useState<CalendarDay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchDailyPnL()
        setData(Array.isArray(res) ? res : [])
      } catch (e) {
        console.error(e)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return (
    <div className="grid grid-cols-7 gap-2">
      {loading ? (
        <div className="col-span-7 rounded-xl border p-4 text-sm text-muted-foreground">
          Loading...
        </div>
      ) : data.length === 0 ? (
        <div className="col-span-7 rounded-xl border p-4 text-sm text-muted-foreground">
          No calendar data
        </div>
      ) : (
        data.map((day) => (
          <div
            key={day.date}
            className={`min-h-[90px] rounded-xl border p-2 ${getColor(day.net)}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium">
                {day.date.slice(-2)}
              </p>
            </div>

            <p className="text-sm font-semibold">
              {formatSignedCurrency(day.net)}
            </p>

            <p className="mt-1 text-[11px] opacity-90">
              F {formatSignedCurrency(day.fundingFee)} | C{" "}
              {formatSignedCurrency(day.commission)}
            </p>

            {day.realizedPnl !== 0 && (
              <p className="mt-1 text-[11px] opacity-80">
                R {formatSignedCurrency(day.realizedPnl)}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  )
}