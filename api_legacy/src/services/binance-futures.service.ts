import crypto from "node:crypto"

const BINANCE_FUTURES_BASE_URL =
  process.env.BINANCE_FUTURES_BASE_URL || "https://fapi.binance.com"

export type BinanceFuturesAsset = {
  asset: string
  walletBalance: string
  unrealizedProfit: string
  marginBalance: string
  maintMargin: string
  initialMargin: string
  positionInitialMargin: string
  openOrderInitialMargin: string
  crossWalletBalance: string
  crossUnPnl: string
  availableBalance: string
  maxWithdrawAmount: string
  updateTime: number
}

export type BinanceFuturesAccountInfo = {
  totalWalletBalance: string
  totalUnrealizedProfit: string
  totalMarginBalance: string
  totalInitialMargin: string
  totalMaintMargin: string
  totalPositionInitialMargin: string
  totalOpenOrderInitialMargin: string
  totalCrossWalletBalance: string
  totalCrossUnPnl: string
  availableBalance: string
  maxWithdrawAmount: string
  assets: BinanceFuturesAsset[]
}

export type BinanceFuturesBalance = {
  accountAlias: string
  asset: string
  balance: string
  crossWalletBalance: string
  crossUnPnl: string
  availableBalance: string
  maxWithdrawAmount: string
  marginAvailable: boolean
  updateTime: number
}

export type BinanceFuturesPosition = {
  symbol: string
  positionAmt: string
  entryPrice: string
  breakEvenPrice?: string
  markPrice: string
  unRealizedProfit: string
  liquidationPrice: string
  leverage: string
  marginType: string
  isolatedMargin: string
  positionSide: string
  notional: string
  updateTime: number
}

export type BinanceIncomeType =
  | "FUNDING_FEE"
  | "COMMISSION"
  | "REALIZED_PNL"

export type BinanceFuturesIncome = {
  symbol: string
  incomeType: string
  income: string
  asset: string
  info: string
  time: number
  tranId: number
  tradeId: string
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

function buildSignedUrl(
  pathname: string,
  apiSecret: string,
  extraParams?: Record<string, string>,
) {
  const params = new URLSearchParams({
    recvWindow: "5000",
    timestamp: String(Date.now()),
    ...(extraParams ?? {}),
  })

  const queryString = params.toString()
  const signature = buildSignature(queryString, apiSecret)

  return `${BINANCE_FUTURES_BASE_URL}${pathname}?${queryString}&signature=${signature}`
}

async function getSigned<T>(
  pathname: string,
  apiKey: string,
  apiSecret: string,
  extraParams?: Record<string, string>,
): Promise<T> {
  const cleanApiKey = sanitizeAscii(apiKey)
  const cleanApiSecret = sanitizeAscii(apiSecret)

  const url = buildSignedUrl(pathname, cleanApiSecret, extraParams)

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-MBX-APIKEY": cleanApiKey,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Binance Futures API error: ${response.status} ${errorText}`,
    )
  }

  return (await response.json()) as T
}

export async function getBinanceFuturesAccountInfo(
  apiKey: string,
  apiSecret: string,
): Promise<BinanceFuturesAccountInfo> {
  return getSigned<BinanceFuturesAccountInfo>(
    "/fapi/v2/account",
    apiKey,
    apiSecret,
  )
}

export async function getBinanceFuturesBalances(
  apiKey: string,
  apiSecret: string,
): Promise<BinanceFuturesBalance[]> {
  return getSigned<BinanceFuturesBalance[]>(
    "/fapi/v2/balance",
    apiKey,
    apiSecret,
  )
}

export async function getBinanceFuturesPositions(
  apiKey: string,
  apiSecret: string,
): Promise<BinanceFuturesPosition[]> {
  return getSigned<BinanceFuturesPosition[]>(
    "/fapi/v3/positionRisk",
    apiKey,
    apiSecret,
  )
}

export async function getBinanceFuturesIncomeHistory(
  apiKey: string,
  apiSecret: string,
  incomeType: BinanceIncomeType,
  startTime?: number,
  endTime?: number,
): Promise<BinanceFuturesIncome[]> {
  const params: Record<string, string> = {
    incomeType,
    limit: "1000",
  }

  if (startTime) params.startTime = String(startTime)
  if (endTime) params.endTime = String(endTime)

  return getSigned<BinanceFuturesIncome[]>(
    "/fapi/v1/income",
    apiKey,
    apiSecret,
    params,
  )
}

export function getNonZeroFuturesBalances(
  balances: BinanceFuturesBalance[],
): BinanceFuturesBalance[] {
  return balances.filter((balance) => Number(balance.balance) !== 0)
}

export function getOpenFuturesPositions(
  positions: BinanceFuturesPosition[],
): BinanceFuturesPosition[] {
  return positions.filter((position) => Number(position.positionAmt) !== 0)
}

export function summarizeFuturesAccount(
  accountInfo: BinanceFuturesAccountInfo,
) {
  return {
    totalWalletBalance: Number(accountInfo.totalWalletBalance),
    totalUnrealizedProfit: Number(accountInfo.totalUnrealizedProfit),
    totalMarginBalance: Number(accountInfo.totalMarginBalance),
    totalInitialMargin: Number(accountInfo.totalInitialMargin),
    totalMaintMargin: Number(accountInfo.totalMaintMargin),
    availableBalance: Number(accountInfo.availableBalance),
    maxWithdrawAmount: Number(accountInfo.maxWithdrawAmount),
  }
}