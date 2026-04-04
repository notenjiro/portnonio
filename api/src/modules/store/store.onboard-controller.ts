import type { Request, Response, NextFunction } from "express";
import { ValidationError } from "../../shared/errors";
import {
  createAssetFromProvider,
  listAssets,
  linkAssetToAccount
} from "./store.service";
import { refreshMarketAsset } from "../market/market.service";
import { refreshFundNav } from "../fund/fund.service";
import { rebuildDerivedPortfolioViewsFromHistory } from "./store.history-service";

export async function onboardAssetFromProviderHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { provider, symbol, name, exchange, projId, currency, accountId, quantity } =
      req.body ?? {};

    if (!provider || !symbol || !name || !currency || !accountId) {
      throw new ValidationError("provider, symbol, name, currency, accountId are required");
    }

    const existingAssets = await listAssets();
    let asset = existingAssets.find(
      (a) => a.symbol.toLowerCase() === String(symbol).toLowerCase()
    );

    if (!asset) {
      asset = await createAssetFromProvider({
        provider,
        symbol,
        name,
        exchange,
        projId,
        currency
      });
    }

    const link = await linkAssetToAccount({
      accountId,
      assetId: asset.id,
      quantity: quantity ?? 1
    });

    let refreshResult: unknown = null;
    let refreshWarning: string | null = null;

    try {
      if (provider === "twelvedata") {
        refreshResult = await refreshMarketAsset(asset.id);
      } else if (provider === "sec") {
        refreshResult = await refreshFundNav(asset.id);
      }
    } catch (error) {
      refreshWarning =
        error instanceof Error ? error.message : "Refresh step failed";
    }

    let rebuildResult: unknown = null;
    let rebuildWarning: string | null = null;

    try {
      rebuildResult = await rebuildDerivedPortfolioViewsFromHistory();
    } catch (error) {
      rebuildWarning =
        error instanceof Error ? error.message : "Rebuild step failed";
    }

    res.status(201).json({
      ok: true,
      data: {
        asset,
        link,
        refresh: refreshResult,
        rebuild: rebuildResult,
        warnings: {
          refresh: refreshWarning,
          rebuild: rebuildWarning
        }
      }
    });
  } catch (error) {
    next(error);
  }
}