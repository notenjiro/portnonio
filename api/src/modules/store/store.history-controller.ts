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

/**
 * 🔥 MAIN: REBUILD + BREAKDOWN
 */
export async function rebuildDerivedPortfolioViewsHandler(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await rebuildDerivedPortfolioViewsFromHistory();

    const { calendar, snapshots, breakdown } = result;

    res.status(201).json({
      ok: true,
      data: {
        calendar,
        snapshots,

        /**
         * 🧠 flatten ให้ frontend ใช้ง่าย
         */
        breakdown: {
          totalDays: breakdown.totalDays,
          winningDays: breakdown.winningDays,
          losingDays: breakdown.losingDays,
          flatDays: breakdown.flatDays,

          winRate: breakdown.winRate,

          maxDrawdown: breakdown.maxDrawdown,

          equityCurve: breakdown.cumulativeEquityCurve
        }
      }
    });
  } catch (error) {
    next(error);
  }
}