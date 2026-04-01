export type Summary = {
  totalValue: number
  todayPnL: number
  accounts: number
  spotValue: number
  futuresWallet: number
  futuresPnL: number
  stockValue: number
  fundValue: number
  cashBalance: number
}

export type SpotHolding = {
  asset: string
  amount: number
  value: number
}

export type FuturesPosition = {
  symbol: string
  side: string
  size: number
  entryPrice: number
  markPrice: number
  pnl: number
  notional: number
  leverage: number
}

export type SyncStatus = "idle" | "success" | "failed" | "skipped"

export type StockHolding = {
  symbol: string
  name: string
  quantity: number
  averageCost: number
  lastPrice: number
  marketValue: number
  costValue: number
  unrealizedPnL: number
  lastSyncedAt?: string
  lastSyncStatus?: SyncStatus
  lastSyncMessage?: string
  lastPriceDate?: string
  lastPriceSource?: string
}

export type FundHolding = {
  symbol: string
  name: string
  units: number
  nav: number
  marketValue: number
  costValue: number
  unrealizedPnL: number
  lastSyncedAt?: string
  lastSyncStatus?: SyncStatus
  lastSyncMessage?: string
  lastPriceDate?: string
  lastPriceSource?: string
}

export type Breakdown = {
  spotValue: number
  futuresWallet: number
  futuresPnL: number
  stockValue: number
  fundValue: number
  cashBalance: number
  spotHoldings: SpotHolding[]
  futuresPositions: FuturesPosition[]
  stockHoldings: StockHolding[]
  fundHoldings: FundHolding[]
}

export type EquityPoint = {
  date: string
  totalValue: number
  spotValue: number
  futuresWallet: number
  stockValue: number
  fundValue: number
  cashBalance: number
}

export type AlertItem = {
  level: "high" | "medium"
  title: string
  detail: string
}

export type AccountBreakdownItem = {
  id: string
  provider: "binance" | "innovestx"
  createdAt: string
  totalValue: number
  spotValue: number
  futuresWallet: number
  futuresPnL: number
  stockValue: number
  fundValue: number
  cashBalance: number
}

export type TabKey = "overview" | "calendar" | "positions"