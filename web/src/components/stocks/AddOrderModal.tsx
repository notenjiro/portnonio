import { useEffect, useMemo, useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Asset = {
  id: string
  symbol: string
  name: string
  assetType: "fund" | "thai_stock" | "us_stock"
  market: "FUND" | "SET" | "US"
  currency: "THB" | "USD"
}

type LatestPrice = {
  assetId: string
  price: number
}

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  initialAssetId?: string
}

type OrderSide = "buy" | "sell"

function getMarketBadgeClass(market: Asset["market"]) {
  if (market === "FUND") {
    return "bg-slate-100 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300"
  }

  if (market === "SET") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
  }

  return "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
}

export default function AddOrderModal({
  open,
  onClose,
  onSuccess,
  initialAssetId,
}: Props) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetId, setAssetId] = useState("")
  const [assetPickerOpen, setAssetPickerOpen] = useState(false)
  const [side, setSide] = useState<OrderSide>("buy")
  const [quantity, setQuantity] = useState("1")
  const [price, setPrice] = useState("")
  const [fee, setFee] = useState("0")
  const [tradeDate, setTradeDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [note, setNote] = useState("")
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [latestPrices, setLatestPrices] = useState<LatestPrice[]>([])
  const [userEditedPrice, setUserEditedPrice] = useState(false)

  useEffect(() => {
    if (!open) return

    async function loadAssets() {
      try {
        setLoadingAssets(true)
        setError("")

        const res = await fetch("http://localhost:3001/stock/assets")
        const json = await res.json()

        setAssets(Array.isArray(json.assets) ? json.assets : [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load assets")
      } finally {
        setLoadingAssets(false)
      }
    }

    loadAssets()
  }, [open])

  useEffect(() => {
    if (!open) return

    async function loadLatestPrices() {
      try {
        const res = await fetch("http://localhost:3001/stock/prices/latest")
        const json = await res.json()

        setLatestPrices(Array.isArray(json.prices) ? json.prices : [])
      } catch {
        setLatestPrices([])
      }
    }

    loadLatestPrices()
  }, [open])

  useEffect(() => {
  if (!open || !initialAssetId) return
  setAssetId(initialAssetId)
}, [open, initialAssetId])

  const selectedAsset = useMemo(
    () => assets.find((item) => item.id === assetId) ?? null,
    [assets, assetId],
  )

  const previewNotional = useMemo(() => {
    const qty = Number(quantity)
    const px = Number(price)
    const feeValue = Number(fee)

    if (!Number.isFinite(qty) || !Number.isFinite(px) || qty <= 0 || px < 0) {
      return 0
    }

    return qty * px + (Number.isFinite(feeValue) ? feeValue : 0)
  }, [quantity, price, fee])

  function resetForm() {
    setAssetId("")
    setAssetPickerOpen(false)
    setSide("buy")
    setQuantity("1")
    setPrice("")
    setFee("0")
    setTradeDate(new Date().toISOString().slice(0, 10))
    setNote("")
    setError("")
    setSubmitting(false)
    setUserEditedPrice(false)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm()
      onClose()
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")

    if (!assetId) {
      setError("Please select an asset")
      return
    }

    const payload = {
      assetId,
      side,
      quantity: Number(quantity),
      price: Number(price),
      fee: Number(fee),
      tradeDate,
      note: note.trim() || undefined,
    }

    if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
      setError("Quantity must be greater than 0")
      return
    }

    if (!Number.isFinite(payload.price) || payload.price < 0) {
      setError("Price must be 0 or greater")
      return
    }

    if (!Number.isFinite(payload.fee) || payload.fee < 0) {
      setError("Fee must be 0 or greater")
      return
    }

    try {
      setSubmitting(true)

      const res = await fetch("http://localhost:3001/stock/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!json.success) {
        throw new Error(json.message || "Failed to create order")
      }

      onSuccess?.();
      resetForm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Order</DialogTitle>
          <DialogDescription>
            Record a buy or sell transaction for your stock or fund ledger.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Asset</Label>

              <Popover open={assetPickerOpen} onOpenChange={setAssetPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={assetPickerOpen}
                    className="h-11 w-full justify-between rounded-xl px-3 font-normal shadow-sm"
                    disabled={loadingAssets}
                  >
                    <span className="truncate text-left">
                      {selectedAsset
                        ? `${selectedAsset.symbol} · ${selectedAsset.name}`
                        : loadingAssets
                          ? "Loading assets..."
                          : "Search asset..."}
                    </span>

                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  align="start"
                  className="w-[--radix-popover-trigger-width] rounded-xl border p-2 shadow-md"
                >
                  <Command className="rounded-lg bg-transparent">
                    <div className="rounded-lg border bg-background px-2">
                      <CommandInput
                        placeholder="Search by symbol or name..."
                        className="h-10 border-0 bg-transparent text-sm outline-none ring-0 focus:ring-0"
                      />
                    </div>

                    <CommandList className="mt-2 max-h-[260px] overflow-y-auto">
                      <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                        No asset found.
                      </CommandEmpty>

                      <CommandGroup className="space-y-1">
                        {assets.map((asset) => (
                          <CommandItem
                            key={asset.id}
                            value={`${asset.symbol} ${asset.name} ${asset.market}`}
                            onSelect={() => {
                              setAssetId(asset.id)
                              setAssetPickerOpen(false)

                              if (!userEditedPrice && !price) {
                                const latest = latestPrices.find(
                                  (p) => p.assetId === asset.id,
                                )
                                if (latest?.price) {
                                  setPrice(String(latest.price))
                                }
                              }
                            }}
                            className="flex items-start gap-2 rounded-lg px-3 py-3 aria-selected:bg-muted"
                          >
                            <Check
                              className={`mt-0.5 h-4 w-4 shrink-0 ${
                                assetId === asset.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-medium">
                                  {asset.symbol}
                                </span>
                                <span
                                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase ${getMarketBadgeClass(
                                    asset.market,
                                  )}`}
                                >
                                  {asset.market}
                                </span>
                              </div>

                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {asset.name}
                              </p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Side</Label>
              <Select
                value={side}
                onValueChange={(value: OrderSide) => setSide(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select side" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trade-date">Trade Date</Label>
              <Input
                id="trade-date"
                type="date"
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity / Units</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">
                Price {selectedAsset ? `(${selectedAsset.currency})` : ""}
              </Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="any"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value)
                  setUserEditedPrice(true)
                }}
                placeholder="100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fee">Fee</Label>
              <Input
                id="fee"
                type="number"
                min="0"
                step="any"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-sm font-medium">Order preview</p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border bg-background/80 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Asset
                </p>
                <p className="mt-1 font-medium">
                  {selectedAsset ? selectedAsset.symbol : "-"}
                </p>
              </div>

              <div className="rounded-lg border bg-background/80 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Side
                </p>
                <p className="mt-1 font-medium capitalize">{side}</p>
              </div>

              <div className="rounded-lg border bg-background/80 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Quantity
                </p>
                <p className="mt-1 font-medium">{quantity || "-"}</p>
              </div>

              <div className="rounded-lg border bg-background/80 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Price
                </p>
                <p className="mt-1 font-medium">
                  {price || "-"} {selectedAsset?.currency ?? ""}
                </p>
              </div>

              <div className="rounded-lg border bg-background/80 px-3 py-2 md:col-span-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Estimated Notional
                </p>
                <p className="mt-1 text-base font-semibold">
                  {Number.isFinite(previewNotional)
                    ? previewNotional.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "-"}{" "}
                  {selectedAsset?.currency ?? ""}
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
            <Button type="submit" disabled={submitting || loadingAssets}>
              {submitting ? "Saving..." : "Save Order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}