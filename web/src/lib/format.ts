const DEFAULT_LOCALE = "en-US"
const DEFAULT_CURRENCY = "USD"

function normalizeCurrency(currency?: string): string {
  return (currency ?? DEFAULT_CURRENCY).toUpperCase()
}

function getCurrencyLocale(currency?: string): string {
  const normalized = normalizeCurrency(currency)

  if (normalized === "THB") {
    return "th-TH"
  }

  return DEFAULT_LOCALE
}

export function formatMoney(
  value: number,
  fractionDigits = 2,
  currency = DEFAULT_CURRENCY
) {
  const normalizedCurrency = normalizeCurrency(currency)

  return new Intl.NumberFormat(getCurrencyLocale(normalizedCurrency), {
    style: "currency",
    currency: normalizedCurrency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(value)
}

export function formatSignedMoney(
  value: number,
  fractionDigits = 2,
  currency = DEFAULT_CURRENCY
) {
  const sign = value >= 0 ? "+" : "-"
  return `${sign}${formatMoney(Math.abs(value), fractionDigits, currency)}`
}