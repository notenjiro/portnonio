import { useState } from "react"
import { getAssetIconUrl, getAssetInitial } from "@/lib/asset-icons"

type Props = {
  symbol: string
  size?: number
}

export default function AssetIcon({ symbol, size = 18 }: Props) {
  const [failed, setFailed] = useState(false)

  const url = getAssetIconUrl(symbol)

  if (!url || failed) {
    return (
      <div
        className="flex items-center justify-center rounded-full border bg-muted text-[10px] font-semibold text-muted-foreground"
        style={{ width: size, height: size }}
      >
        {getAssetInitial(symbol)}
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={symbol}
      width={size}
      height={size}
      className="rounded-full grayscale"
      onError={() => setFailed(true)}
    />
  )
}