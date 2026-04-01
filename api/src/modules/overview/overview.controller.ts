import type { NextFunction, Request, Response } from "express";
import { getOverviewData } from "./overview.service";

export async function getOverviewHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getOverviewData();

    res.json({
      ok: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}