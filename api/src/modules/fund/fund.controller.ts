import type { NextFunction, Request, Response } from "express";
import { ValidationError } from "../../shared/errors";
import { backfillFundNavHistory, refreshFundNav } from "./fund.service";

export async function refreshFundNavHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawAssetId = req.params.assetId;

    if (typeof rawAssetId !== "string" || !rawAssetId) {
      throw new ValidationError("Invalid assetId");
    }

    const result = await refreshFundNav(rawAssetId);

    res.status(201).json({
      ok: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function backfillFundNavHistoryHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawAssetId = req.params.assetId;

    if (typeof rawAssetId !== "string" || !rawAssetId) {
      throw new ValidationError("Invalid assetId");
    }

    const rawDays = req.body?.days;
    const days =
      rawDays === undefined || rawDays === null || rawDays === ""
        ? 365
        : Number(rawDays);

    if (!Number.isFinite(days) || days <= 0) {
      throw new ValidationError("days must be greater than 0");
    }

    const result = await backfillFundNavHistory(rawAssetId, days);

    res.status(201).json({
      ok: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}