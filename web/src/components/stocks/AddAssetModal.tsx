import { useMemo, useState } from "react"
import { Landmark, BadgeDollarSign, Globe2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: (asset: {
    id: string
    symbol: string
    name: string
    assetType: "fund" | "thai_stock" | "us_stock"
    market: "FUND" | "SET" | "US"
    currency: "THB" | "USD"
    priceSource: "daily_nav" | "live_api" | "manual"
  }) => void
}

type AssetType = "fund" | "thai_stock" | "us_stock"
type Market = "FUND" | "SET" | "US"
type Currency = "THB" | "USD"
type PriceSource = "daily_nav" | "live_api" | "manual"

function getAssetTypeMeta(assetType: AssetType) {
  if (assetType === "fund") {
    return {
      icon: Landmark,
      label: "Fund",
      description: "Best for mutual funds that refresh using latest NAV once per day.",
      badgeClass:
        "bg-slate-100 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300",
    }
  }

  if (assetType === "thai_stock") {
    return {
      icon: BadgeDollarSign,
      label: "Thai Stock",
      description: "Best for SET-listed assets with THB pricing and market-based tracking.",
      badgeClass:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    }
  }

  return {
    icon: Globe2,
    label: "US Stock",
    description: "Best for US market assets with USD pricing and live API support.",
    badgeClass:
      "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  }
}

export default function AddAssetModal({
  open,
  onClose,
  onSuccess,
}: Props) {
  const [symbol, setSymbol] = useState("")
  const [name, setName] = useState("")
  const [assetType, setAssetType] = useState<AssetType>("fund")
  const [market, setMarket] = useState<Market>("FUND")
  const [currency, setCurrency] = useState<Currency>("THB")
  const [priceSource, setPriceSource] = useState<PriceSource>("daily_nav")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const assetMeta = useMemo(() => getAssetTypeMeta(assetType), [assetType])

  function resetForm() {
    setSymbol("")
    setName("")
    setAssetType("fund")
    setMarket("FUND")
    setCurrency("THB")
    setPriceSource("daily_nav")
    setSubmitting(false)
    setError("")
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm()
      onClose()
    }
  }

  function syncDefaultsByAssetType(nextType: AssetType) {
    setAssetType(nextType)

    if (nextType === "fund") {
      setMarket("FUND")
      setCurrency("THB")
      setPriceSource("daily_nav")
      return
    }

    if (nextType === "thai_stock") {
      setMarket("SET")
      setCurrency("THB")
      setPriceSource("live_api")
      return
    }

    setMarket("US")
    setCurrency("USD")
    setPriceSource("live_api")
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")

    const payload = {
      symbol: symbol.trim().toUpperCase(),
      name: name.trim(),
      assetType,
      market,
      currency,
      priceSource,
    }

    if (!payload.symbol || !payload.name) {
      setError("Please fill in symbol and name")
      return
    }

    try {
      setSubmitting(true)

      const res = await fetch("http://localhost:3001/stock/assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!json.success) {
        throw new Error(json.message || "Failed to create asset")
      }

      onSuccess(json.asset)
      resetForm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create asset")
    } finally {
      setSubmitting(false)
    }
  }

  const Icon = assetMeta.icon

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Asset</DialogTitle>
          <DialogDescription>
            Create a stock or fund asset for your portfolio ledger.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="asset-symbol">Symbol</Label>
              <Input
                id="asset-symbol"
                placeholder="SCBS&P500"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="asset-name">Name</Label>
              <Input
                id="asset-name"
                placeholder="SCB S&P 500"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Asset Type</Label>
              <Select
                value={assetType}
                onValueChange={(value: AssetType) =>
                  syncDefaultsByAssetType(value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select asset type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fund">Fund</SelectItem>
                  <SelectItem value="thai_stock">Thai Stock</SelectItem>
                  <SelectItem value="us_stock">US Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Market</Label>
              <Select
                value={market}
                onValueChange={(value: Market) => setMarket(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select market" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FUND">FUND</SelectItem>
                  <SelectItem value="SET">SET</SelectItem>
                  <SelectItem value="US">US</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={currency}
                onValueChange={(value: Currency) => setCurrency(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="THB">THB</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Price Source</Label>
              <Select
                value={priceSource}
                onValueChange={(value: PriceSource) => setPriceSource(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select price source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily_nav">Daily NAV</SelectItem>
                  <SelectItem value="live_api">Live API</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-sm font-medium">Asset preview</p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border bg-background/80 px-3 py-2 md:col-span-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border bg-muted/60 p-2">
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">
                        {symbol.trim().toUpperCase() || "SYMBOL"}
                      </p>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase ${assetMeta.badgeClass}`}
                      >
                        {assetMeta.label}
                      </span>
                    </div>

                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {name.trim() || "Asset name preview"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-background/80 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Market
                </p>
                <p className="mt-1 font-medium">{market}</p>
              </div>

              <div className="rounded-lg border bg-background/80 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Currency
                </p>
                <p className="mt-1 font-medium">{currency}</p>
              </div>

              <div className="rounded-lg border bg-background/80 px-3 py-2 md:col-span-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Price Source
                </p>
                <p className="mt-1 font-medium">
                  {priceSource === "daily_nav"
                    ? "Daily NAV"
                    : priceSource === "live_api"
                      ? "Live API"
                      : "Manual"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {assetMeta.description}
                </p>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Asset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}