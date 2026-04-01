import type { NextFunction, Request, Response } from "express";
import { ValidationError } from "../../shared/errors";
import { runBinanceSync } from "./binance-sync.service";

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