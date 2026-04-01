export function formatMoney(value: number, fractionDigits = 2) {
  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
  })}`
}

export function formatSignedMoney(value: number, fractionDigits = 2) {
  return `${value >= 0 ? "+" : ""}$${value.toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
  })}`
}