const SYMBOL_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  SOL: "solana",
  SHIB: "shiba-inu",
  FDUSD: "first-digital-usd",
  USDT: "tether",
  USDC: "usd-coin",
  ARK: "ark",
  XEC: "ecash",
}

export function getBaseAssetFromSymbol(symbol: string) {
  if (symbol.endsWith("USDT")) return symbol.replace("USDT", "")
  if (symbol.endsWith("FDUSD")) return symbol.replace("FDUSD", "")
  if (symbol.endsWith("BUSD")) return symbol.replace("BUSD", "")
  return symbol
}

export function getAssetIconUrl(assetOrSymbol: string) {
  const base = getBaseAssetFromSymbol(assetOrSymbol).toUpperCase()
  const slug = SYMBOL_MAP[base]

  if (!slug) return null

  return `https://assets.coingecko.com/coins/images/1/small/${slug}.png`
}

export function getAssetInitial(assetOrSymbol: string) {
  const base = getBaseAssetFromSymbol(assetOrSymbol).toUpperCase()
  return base.slice(0, 1)
}