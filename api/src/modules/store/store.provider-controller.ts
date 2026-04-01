import type { NextFunction, Request, Response } from "express";
import { ValidationError } from "../../shared/errors";
import { getBinanceSyncReadiness } from "../../providers/binance.adapter";
import { getProviderHealth, listSupportedProviders } from "../../providers/provider-registry";

export async function listProvidersHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const providers = listSupportedProviders();

    res.json({
      ok: true,
      data: providers
    });
  } catch (error) {
    next(error);
  }
}

export async function providerHealthHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const health = getProviderHealth();

    res.json({
      ok: true,
      data: health
    });
  } catch (error) {
    next(error);
  }
}

export async function getBinanceReadinessHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const rawAccountId = req.params.accountId;

    if (typeof rawAccountId !== "string" || !rawAccountId) {
      throw new ValidationError("Invalid accountId");
    }

    const readiness = await getBinanceSyncReadiness(rawAccountId);

    res.json({
      ok: true,
      data: readiness
    });
  } catch (error) {
    next(error);
  }
}