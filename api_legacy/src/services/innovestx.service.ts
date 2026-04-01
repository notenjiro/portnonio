import crypto from "node:crypto";

export type InnovestXStockHolding = {
  symbol: string;
  name: string;
  quantity: number;
  averageCost: number;
  lastPrice: number;
  marketValue: number;
  costValue: number;
  unrealizedPnL: number;
};

export type InnovestXFundHolding = {
  symbol: string;
  name: string;
  units: number;
  nav: number;
  marketValue: number;
  costValue: number;
  unrealizedPnL: number;
};

export type InnovestXPortfolio = {
  accountNo: string;
  cashBalance: number;
  stocks: InnovestXStockHolding[];
  funds: InnovestXFundHolding[];
};

function hashNumber(seed: string, min: number, max: number) {
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  const intValue = Number.parseInt(hash.slice(0, 12), 16);
  const ratio = intValue / 0xffffffffffff;
  return min + ratio * (max - min);
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildStock(
  seed: string,
  symbol: string,
  name: string,
  priceMin: number,
  priceMax: number,
  qtyMin: number,
  qtyMax: number,
) {
  const quantity = Math.floor(hashNumber(`${seed}:${symbol}:qty`, qtyMin, qtyMax));
  const lastPrice = round(hashNumber(`${seed}:${symbol}:price`, priceMin, priceMax), 2);
  const avgFactor = hashNumber(`${seed}:${symbol}:avgFactor`, 0.9, 1.1);
  const averageCost = round(lastPrice * avgFactor, 2);

  const marketValue = round(quantity * lastPrice, 2);
  const costValue = round(quantity * averageCost, 2);
  const unrealizedPnL = round(marketValue - costValue, 2);

  return {
    symbol,
    name,
    quantity,
    averageCost,
    lastPrice,
    marketValue,
    costValue,
    unrealizedPnL,
  };
}

function buildFund(
  seed: string,
  symbol: string,
  name: string,
  navMin: number,
  navMax: number,
  unitsMin: number,
  unitsMax: number,
) {
  const units = round(hashNumber(`${seed}:${symbol}:units`, unitsMin, unitsMax), 4);
  const nav = round(hashNumber(`${seed}:${symbol}:nav`, navMin, navMax), 4);
  const avgFactor = hashNumber(`${seed}:${symbol}:avgFactor`, 0.92, 1.08);
  const averageCost = round(nav * avgFactor, 4);

  const marketValue = round(units * nav, 2);
  const costValue = round(units * averageCost, 2);
  const unrealizedPnL = round(marketValue - costValue, 2);

  return {
    symbol,
    name,
    units,
    nav,
    marketValue,
    costValue,
    unrealizedPnL,
  };
}

export async function getInnovestXPortfolio(
  apiKey: string,
  apiSecret: string,
): Promise<InnovestXPortfolio> {
  const seed = `${apiKey}:${apiSecret}`.trim();

  const cashBalance = round(hashNumber(`${seed}:cash`, 15000, 220000), 2);

  const stocks: InnovestXStockHolding[] = [
    buildStock(seed, "AOT", "Airports of Thailand", 55, 72, 20, 250),
    buildStock(seed, "PTT", "PTT Public Company", 28, 38, 50, 400),
    buildStock(seed, "CPALL", "CP All", 48, 72, 20, 220),
    buildStock(seed, "BDMS", "Bangkok Dusit Medical Services", 24, 36, 40, 500),
  ].filter((item) => item.quantity > 0);

  const funds: InnovestXFundHolding[] = [
    buildFund(seed, "KFGBRAND", "Krungsri Global Brand Equity", 14, 22, 100, 2500),
    buildFund(seed, "SCBSET50", "SCB SET50 Index Fund", 8, 15, 200, 5000),
  ].filter((item) => item.units > 0);

  const accountNo = `IX-${crypto
    .createHash("md5")
    .update(seed)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase()}`;

  return {
    accountNo,
    cashBalance,
    stocks,
    funds,
  };
}

export function summarizeInnovestXPortfolio(portfolio: InnovestXPortfolio) {
  const stockValue = portfolio.stocks.reduce(
    (sum, item) => sum + item.marketValue,
    0,
  );

  const fundValue = portfolio.funds.reduce(
    (sum, item) => sum + item.marketValue,
    0,
  );

  const unrealizedPnL =
    portfolio.stocks.reduce((sum, item) => sum + item.unrealizedPnL, 0) +
    portfolio.funds.reduce((sum, item) => sum + item.unrealizedPnL, 0);

  const totalValue = round(portfolio.cashBalance + stockValue + fundValue, 2);

  return {
    cashBalance: round(portfolio.cashBalance, 2),
    stockValue: round(stockValue, 2),
    fundValue: round(fundValue, 2),
    totalValue,
    unrealizedPnL: round(unrealizedPnL, 2),
  };
}