import type { NextFunction, Request, Response } from "express";
import {
  readBinanceHistory,
  readFundHistory,
  readMarketHistory,
  readPortfolioCalendar,
  readPortfolioSnapshots
} from "../../storage/history.repository";
import {
  rebuildDerivedPortfolioViewsFromHistory
} from "./store.history-service";

export async function getBinanceHistoryHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const records = await readBinanceHistory();

    res.json({
      ok: true,
      data: records
    });
  } catch (error) {
    next(error);
  }
}

export async function getMarketHistoryHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const records = await readMarketHistory();

    res.json({
      ok: true,
      data: records
    });
  } catch (error) {
    next(error);
  }
}

export async function getFundHistoryHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const records = await readFundHistory();

    res.json({
      ok: true,
      data: records
    });
  } catch (error) {
    next(error);
  }
}

export async function getPortfolioCalendarHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const records = await readPortfolioCalendar();

    res.json({
      ok: true,
      data: records
    });
  } catch (error) {
    next(error);
  }
}

export async function getPortfolioSnapshotsHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const records = await readPortfolioSnapshots();

    res.json({
      ok: true,
      data: records
    });
  } catch (error) {
    next(error);
  }
}

export async function rebuildDerivedPortfolioViewsHandler(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await rebuildDerivedPortfolioViewsFromHistory();

    res.status(201).json({
      ok: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}