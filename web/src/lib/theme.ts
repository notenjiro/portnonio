export type ThemeMode = "light" | "dark" | "system"

const STORAGE_KEY = "portnonio-theme"

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system"

  const value = window.localStorage.getItem(STORAGE_KEY)

  if (value === "light" || value === "dark" || value === "system") {
    return value
  }

  return "system"
}

export function setStoredTheme(theme: ThemeMode) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, theme)
}

export function getResolvedTheme(theme: ThemeMode): "light" | "dark" {
  if (theme === "light" || theme === "dark") return theme

  if (typeof window === "undefined") return "light"

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return

  const resolved = getResolvedTheme(theme)
  const root = document.documentElement

  root.classList.remove("light", "dark")
  root.classList.add(resolved)
}