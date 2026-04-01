import { useMemo, useState } from "react"

import { connectAccount, testProviderAccount } from "@/lib/api"
import type { ProviderName } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type Props = {
  onConnected?: () => void
}

const providerOptions: Array<{
  value: ProviderName
  label: string
  description: string
}> = [
  {
    value: "binance",
    label: "Binance",
    description: "Connect crypto spot and futures using API key / secret",
  },
  {
    value: "innovestx",
    label: "Stock",
    description:
      "Track stocks and funds in your portfolio. This provider will evolve into your stock workspace",
  },
]

export default function ConnectAccountDialog({ onConnected }: Props) {
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState<ProviderName>("binance")
  const [apiKey, setApiKey] = useState("")
  const [apiSecret, setApiSecret] = useState("")

  const [testing, setTesting] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [testResult, setTestResult] = useState<null | {
    totalValue: number
    accountNo?: string
  }>(null)

  const activeProvider = useMemo(
    () => providerOptions.find((item) => item.value === provider),
    [provider],
  )

  const titleText = provider === "innovestx" ? "Connect Stock" : "Connect Binance"

  const helperText =
    provider === "innovestx"
      ? "Use this provider for your stock and fund side. For now it can act as a stock workspace while live price and NAV sources are added step by step."
      : "Your API key and secret will be used to load spot and futures portfolio data."

  function resetMessages() {
    setError("")
    setSuccess("")
    setTestResult(null)
  }

  function getTrimmedInputs() {
    return {
      trimmedApiKey: apiKey.trim(),
      trimmedApiSecret: apiSecret.trim(),
    }
  }

  async function handleTestConnection() {
    resetMessages()

    const { trimmedApiKey, trimmedApiSecret } = getTrimmedInputs()

    if (!trimmedApiKey || !trimmedApiSecret) {
      setError("Please fill in both API key and API secret")
      return
    }

    try {
      setTesting(true)

      const res = await testProviderAccount({
        provider,
        apiKey: trimmedApiKey,
        apiSecret: trimmedApiSecret,
      })

      setTestResult({
        totalValue: res?.totalValue ?? res?.summary?.totalValue ?? 0,
        accountNo: res?.accountNo,
      })

      setSuccess(
        provider === "innovestx"
          ? "Stock test connection passed"
          : "Binance test connection passed",
      )
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to test connection"
      setError(message)
      setTestResult(null)
    } finally {
      setTesting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    resetMessages()

    const { trimmedApiKey, trimmedApiSecret } = getTrimmedInputs()

    if (!trimmedApiKey || !trimmedApiSecret) {
      setError("Please fill in both API key and API secret")
      return
    }

    try {
      setSubmitting(true)

      const res = await connectAccount({
        provider,
        apiKey: trimmedApiKey,
        apiSecret: trimmedApiSecret,
      })

      if (res?.success === false) {
        throw new Error(res?.message || "Failed to connect account")
      }

      setSuccess(
        provider === "innovestx"
          ? "Stock account connected successfully"
          : "Binance account connected successfully",
      )

      setApiKey("")
      setApiSecret("")
      setTestResult(null)

      onConnected?.()

      window.setTimeout(() => {
        setOpen(false)
        setSuccess("")
      }, 700)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to connect account"
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)

    if (!nextOpen) {
      setError("")
      setSuccess("")
      setSubmitting(false)
      setTesting(false)
      setTestResult(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90">
          Add Account
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{titleText}</DialogTitle>
          <DialogDescription>
            Add a portfolio source to portnonio
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Provider</label>

            <div className="grid gap-3 md:grid-cols-2">
              {providerOptions.map((option) => {
                const active = provider === option.value

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setProvider(option.value)
                      resetMessages()
                    }}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-foreground bg-muted"
                        : "border-border hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{option.label}</p>
                      {active ? (
                        <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium">
                          Selected
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border bg-muted/40 p-4">
            <p className="text-sm font-medium">{activeProvider?.label}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {helperText}
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="apiKey" className="text-sm font-medium">
              API Key
            </label>
            <input
              id="apiKey"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value)
                resetMessages()
              }}
              placeholder={
                provider === "innovestx"
                  ? "Enter stock provider key"
                  : "Enter Binance API key"
              }
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-foreground"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="apiSecret" className="text-sm font-medium">
              API Secret
            </label>
            <input
              id="apiSecret"
              type="password"
              value={apiSecret}
              onChange={(e) => {
                setApiSecret(e.target.value)
                resetMessages()
              }}
              placeholder={
                provider === "innovestx"
                  ? "Enter stock provider secret"
                  : "Enter Binance API secret"
              }
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-foreground"
              autoComplete="off"
            />
          </div>

          {provider === "innovestx" ? (
            <div className="rounded-2xl border border-dashed p-4">
              <p className="text-sm font-medium">Current Stock mode</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                This provider is now positioned as your stock workspace. It can
                later support Thai stocks, foreign stocks, and funds under one
                clean portfolio flow.
              </p>
            </div>
          ) : null}

          {testResult ? (
            <div className="rounded-2xl border border-green-200 bg-green-50/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">
                    Test connection successful
                  </p>
                  <p className="mt-1 text-xs text-green-700/80">
                    Portfolio data can be read from this provider.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 text-sm md:min-w-[220px]">
                  {testResult.accountNo ? (
                    <div className="rounded-xl border border-green-200 bg-white/70 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">
                        Account No
                      </p>
                      <p className="font-medium">{testResult.accountNo}</p>
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-green-200 bg-white/70 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">
                      Total Value
                    </p>
                    <p className="font-medium">
                      {Number(testResult.totalValue).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
              {success}
            </div>
          ) : null}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || submitting}
              className="rounded-xl border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border px-4 py-2 text-sm font-medium transition hover:bg-muted"
                disabled={testing || submitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting || testing}
                className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Connecting..." : "Connect"}
              </button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}