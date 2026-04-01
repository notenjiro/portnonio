import crypto from "node:crypto"

const BINANCE_BASE_URL =
  process.env.BINANCE_BASE_URL || "https://api.binance.com"

export type BinanceBalance = {
  asset: string
  free: string
  locked: string
}

export type BinanceAccountInfo = {
  balances: BinanceBalance[]
}

export type BinanceTickerPrice = {
  symbol: string
  price: string
}

function sanitizeAscii(value: string) {
  return value.replace(/[^\x00-\x7F]/g, "").trim()
}

function buildSignature(queryString: string, apiSecret: string) {
  return crypto
    .createHmac("sha256", apiSecret)
    .update(queryString)
    .digest("hex")
}

export async function getBinanceAccountInfo(
  apiKey: string,
  apiSecret: string,
): Promise<BinanceAccountInfo> {
  const cleanApiKey = sanitizeAscii(apiKey)
  const cleanApiSecret = sanitizeAscii(apiSecret)

  const timestamp = Date.now()
  const recvWindow = 5000

  const params = new URLSearchParams({
    timestamp: String(timestamp),
    recvWindow: String(recvWindow),
  })

  const queryString = params.toString()
  const signature = buildSignature(queryString, cleanApiSecret)

  const response = await fetch(
    `${BINANCE_BASE_URL}/api/v3/account?${queryString}&signature=${signature}`,
    {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": cleanApiKey,
      },
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Binance API error: ${response.status} ${errorText}`)
  }

  return (await response.json()) as BinanceAccountInfo
}

export async function getPrices(): Promise<Record<string, number>> {
  const response = await fetch(`${BINANCE_BASE_URL}/api/v3/ticker/price`, {
    method: "GET",
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Binance price API error: ${response.status} ${errorText}`)
  }

  const data = (await response.json()) as BinanceTickerPrice[]
  const priceMap: Record<string, number> = {}

  for (const item of data) {
    priceMap[item.symbol] = Number(item.price)
  }

  return priceMap
}

export function getNonZeroBalances(
  balances: BinanceBalance[],
): BinanceBalance[] {
  return balances.filter((balance) => {
    const free = Number(balance.free)
    const locked = Number(balance.locked)
    return free > 0 || locked > 0
  })
}

export function calculatePortfolioValue(
  balances: BinanceBalance[],
  prices: Record<string, number>,
): number {
  let total = 0

  for (const balance of balances) {
    const amount = Number(balance.free) + Number(balance.locked)
    if (amount === 0) continue

    if (balance.asset === "USDT" || balance.asset === "FDUSD") {
      total += amount
      continue
    }

    const usdtPair = `${balance.asset}USDT`
    const fdusdPair = `${balance.asset}FDUSD`
    const btcPair = `${balance.asset}BTC`

    if (prices[usdtPair]) {
      total += amount * prices[usdtPair]
      continue
    }

    if (prices[fdusdPair]) {
      total += amount * prices[fdusdPair]
      continue
    }

    if (prices[btcPair] && prices["BTCUSDT"]) {
      total += amount * prices[btcPair] * prices["BTCUSDT"]
      continue
    }
  }

  return total
}

export type BinanceDailySnapshotFuturesAsset = {
  asset: string
  marginBalance: string
  walletBalance: string
}

export type BinanceDailySnapshotFuturesPosition = {
  symbol: string
  entryPrice: string
  markPrice: string
  positionAmt: string
  unRealizedProfit: string
}

export type BinanceDailySnapshotVo = {
  type: string
  updateTime: number
  data: {
    assets?: BinanceDailySnapshotFuturesAsset[]
    position?: BinanceDailySnapshotFuturesPosition[]
    balances?: Array<{
      asset: string
      free: string
      locked: string
    }>
    totalAssetOfBtc?: string
  }
}

export type BinanceDailySnapshotResponse = {
  code: number
  msg: string
  snapshotVos: BinanceDailySnapshotVo[]
}

export async function getBinanceDailyAccountSnapshot(
  apiKey: string,
  apiSecret: string,
  type: "SPOT" | "MARGIN" | "FUTURES",
  startTime?: number,
  endTime?: number,
  limit = 30,
): Promise<BinanceDailySnapshotResponse> {
  const cleanApiKey = sanitizeAscii(apiKey)
  const cleanApiSecret = sanitizeAscii(apiSecret)

  const params = new URLSearchParams({
    type,
    limit: String(limit),
    timestamp: String(Date.now()),
    recvWindow: "5000",
  })

  if (startTime) params.set("startTime", String(startTime))
  if (endTime) params.set("endTime", String(endTime))

  const queryString = params.toString()
  const signature = buildSignature(queryString, cleanApiSecret)

  const response = await fetch(
    `${BINANCE_BASE_URL}/sapi/v1/accountSnapshot?${queryString}&signature=${signature}`,
    {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": cleanApiKey,
      },
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Binance snapshot API error: ${response.status} ${errorText}`,
    )
  }

  return (await response.json()) as BinanceDailySnapshotResponse
}