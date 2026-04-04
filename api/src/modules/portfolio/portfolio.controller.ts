import type { Request, Response, NextFunction } from "express";
import { getPortfolioAssets } from "./portfolio.service";

export async function getPortfolioAssetsHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await getPortfolioAssets();

    res.json({
      ok: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}