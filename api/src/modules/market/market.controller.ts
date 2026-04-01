import type { NextFunction, Request, Response } from "express";
import { ValidationError } from "../../shared/errors";
import { refreshMarketAsset } from "./market.service";

export async function refreshMarketAssetHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawAssetId = req.params.assetId;

    if (typeof rawAssetId !== "string" || !rawAssetId) {
      throw new ValidationError("Invalid assetId");
    }

    const result = await refreshMarketAsset(rawAssetId);

    res.status(201).json({
      ok: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}