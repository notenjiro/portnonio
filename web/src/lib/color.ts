export function pnlTextColor(value: number) {
  if (value > 0) return "text-emerald-600 dark:text-emerald-400"
  if (value < 0) return "text-rose-600 dark:text-rose-400"
  return "text-foreground"
}

export function pnlCardTone(value: number) {
  if (value > 0) {
    return "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
  }

  if (value < 0) {
    return "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20"
  }

  return "border-border bg-background dark:border-white/10 dark:bg-white/[0.03]"
}