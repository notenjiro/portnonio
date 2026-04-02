import type { NextFunction, Request, Response } from "express";
import { getRealizedPnlData } from "./pnl.service";

export async function getRealizedPnlHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const rawDays = req.query.days;
    const days =
      typeof rawDays === "string" && rawDays.trim()
        ? Math.max(1, Math.min(365, Number(rawDays)))
        : 30;

    const result = await getRealizedPnlData(Number.isFinite(days) ? days : 30);

    res.json({
      ok: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}