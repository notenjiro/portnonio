import type { ThemeMode } from "@/lib/theme"

type Props = {
  theme: ThemeMode
  onChange: (theme: ThemeMode) => void
}

const options: Array<{ key: ThemeMode; label: string }> = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "system", label: "System" },
]

export default function ThemeToggle({ theme, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 rounded-xl border bg-background p-1">
      {options.map((option) => {
        const active = theme === option.key

        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              active
                ? "bg-foreground text-background"
                : "text-foreground hover:bg-muted"
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}