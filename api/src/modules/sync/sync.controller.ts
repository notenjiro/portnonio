import type { NextFunction, Request, Response } from "express";
import { ValidationError } from "../../shared/errors";
import {
  backfillBinanceRealizedPnl,
  persistBinanceDailySnapshot,
  runBinanceSync
} from "./binance-sync.service";

export async function runBinanceSyncHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const rawAccountId = req.params.accountId;

    if (typeof rawAccountId !== "string" || !rawAccountId) {
      throw new ValidationError("Invalid accountId");
    }

    const result = await runBinanceSync(rawAccountId);

    res.json({
      ok: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function persistBinanceSnapshotHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawAccountId = req.params.accountId;

    if (typeof rawAccountId !== "string" || !rawAccountId) {
      throw new ValidationError("Invalid accountId");
    }

    const result = await persistBinanceDailySnapshot(rawAccountId);

    res.status(201).json({
      ok: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function backfillBinanceRealizedHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawAccountId = req.params.accountId;

    if (typeof rawAccountId !== "string" || !rawAccountId) {
      throw new ValidationError("Invalid accountId");
    }

    const rawDays = req.query.days;
    const parsedDays =
      typeof rawDays === "string" && rawDays.trim() !== ""
        ? Number(rawDays)
        : 30;

    const days = Number.isFinite(parsedDays)
      ? Math.max(1, Math.min(365, Math.trunc(parsedDays)))
      : 30;

    const result = await backfillBinanceRealizedPnl(rawAccountId, days);

    res.status(201).json({
      ok: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}