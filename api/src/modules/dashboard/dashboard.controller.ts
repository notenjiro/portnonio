import type { NextFunction, Request, Response } from "express";
import { getDashboardData } from "./dashboard.service";

export async function getDashboardHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getDashboardData();

    res.json({
      ok: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}