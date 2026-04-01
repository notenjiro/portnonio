import path from "path";

const projectRoot = process.cwd();

export const paths = {
  projectRoot,
  dataDir: path.join(projectRoot, "data"),
  storeFile: path.join(projectRoot, "data", "store.json"),
  binanceHistoryFile: path.join(projectRoot, "data", "binance-history.json"),
  marketHistoryFile: path.join(projectRoot, "data", "market-history.json"),
  fundHistoryFile: path.join(projectRoot, "data", "fund-history.json"),
  fxRatesFile: path.join(projectRoot, "data", "fx-rates.json"),
  portfolioCalendarFile: path.join(projectRoot, "data", "portfolio-calendar.json"),
  portfolioSnapshotsFile: path.join(projectRoot, "data", "portfolio-snapshots.json")
} as const;