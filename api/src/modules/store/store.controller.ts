import type { NextFunction, Request, Response } from "express";
import { ValidationError } from "../../shared/errors";
import {
  createAccountSchema,
  createAssetSchema,
  linkAssetToAccountSchema,
  updateBinanceAccountSettingsSchema
} from "./store.schemas";
import {
  bootstrapStore,
  createAccount,
  createAsset,
  getStore,
  linkAssetToAccount,
  listAccounts,
  listAccountAssetLinks,
  listAssets,
  updateBinanceAccountSettings
} from "./store.service";

function parseSourceQuery(value: unknown): "binance" | "stock" | "fund" | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "binance" || value === "stock" || value === "fund") {
    return value;
  }

  throw new ValidationError("Invalid source filter");
}

export async function getStoreHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const store = await getStore();
    res.json({
      ok: true,
      data: store
    });
  } catch (error) {
    next(error);
  }
}

export async function bootstrapStoreHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const store = await bootstrapStore();
    res.status(201).json({
      ok: true,
      data: store
    });
  } catch (error) {
    next(error);
  }
}

export async function listAccountsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const source = parseSourceQuery(req.query.source);
    const accounts = await listAccounts(source);

    res.json({
      ok: true,
      data: accounts
    });
  } catch (error) {
    next(error);
  }
}

export async function listAssetsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const source = parseSourceQuery(req.query.source);
    const assets = await listAssets(source);

    res.json({
      ok: true,
      data: assets
    });
  } catch (error) {
    next(error);
  }
}

export async function listAccountAssetLinksHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = typeof req.query.accountId === "string" ? req.query.accountId : undefined;
    const links = await listAccountAssetLinks(accountId);

    res.json({
      ok: true,
      data: links
    });
  } catch (error) {
    next(error);
  }
}

export async function createAccountHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createAccountSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join(", "));
    }

    const account = await createAccount(parsed.data);

    res.status(201).json({
      ok: true,
      data: account
    });
  } catch (error) {
    next(error);
  }
}

export async function createAssetHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createAssetSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join(", "));
    }

    const asset = await createAsset(parsed.data);

    res.status(201).json({
      ok: true,
      data: asset
    });
  } catch (error) {
    next(error);
  }
}

export async function updateBinanceAccountSettingsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawAccountId = req.params.accountId;

    if (typeof rawAccountId !== "string" || !rawAccountId) {
      throw new ValidationError("Invalid accountId");
    }

    const parsed = updateBinanceAccountSettingsSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((issue) => issue.message).join(", ")
      );
    }

    const account = await updateBinanceAccountSettings(rawAccountId, parsed.data);

    res.json({
      ok: true,
      data: account
    });
  } catch (error) {
    next(error);
  }
}

export async function linkAssetToAccountHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = linkAssetToAccountSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join(", "));
    }

    const link = await linkAssetToAccount(parsed.data);

    res.status(201).json({
      ok: true,
      data: link
    });
  } catch (error) {
    next(error);
  }
}