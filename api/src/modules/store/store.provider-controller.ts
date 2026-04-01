import type { NextFunction, Request, Response } from "express";
import {
  getBinanceFuturesPositions,
  getBinancePrivateAccountInfo,
  getBinancePublicApiHealth,
  getBinanceSpotHoldings,
  getBinanceSyncReadiness
} from "../../providers/binance.adapter";
import { getProviderHealth, listSupportedProviders } from "../../providers/provider-registry";
import { ValidationError } from "../../shared/errors";

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

export async function getBinancePublicHealthHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const health = await getBinancePublicApiHealth();

    res.json({
      ok: true,
      data: health
    });
  } catch (error) {
    next(error);
  }
}

export async function getBinancePrivateAccountInfoHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawAccountId = req.params.accountId;

    if (typeof rawAccountId !== "string" || !rawAccountId) {
      throw new ValidationError("Invalid accountId");
    }

    const accountInfo = await getBinancePrivateAccountInfo(rawAccountId);

    res.json({
      ok: true,
      data: accountInfo
    });
  } catch (error) {
    next(error);
  }
}

export async function getBinanceSpotHoldingsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawAccountId = req.params.accountId;

    if (typeof rawAccountId !== "string" || !rawAccountId) {
      throw new ValidationError("Invalid accountId");
    }

    const holdings = await getBinanceSpotHoldings(rawAccountId);

    res.json({
      ok: true,
      data: holdings
    });
  } catch (error) {
    next(error);
  }
}

export async function getBinanceFuturesPositionsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawAccountId = req.params.accountId;

    if (typeof rawAccountId !== "string" || !rawAccountId) {
      throw new ValidationError("Invalid accountId");
    }

    const positions = await getBinanceFuturesPositions(rawAccountId);

    res.json({
      ok: true,
      data: positions
    });
  } catch (error) {
    next(error);
  }
}