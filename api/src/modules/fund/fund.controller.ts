import type { NextFunction, Request, Response } from "express";
import { ValidationError } from "../../shared/errors";
import { refreshFundNav } from "./fund.service";

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