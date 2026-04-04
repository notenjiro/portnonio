import type { NextFunction, Request, Response } from "express";
import { ValidationError } from "../../shared/errors";
import {
  createAccountSchema,
  createAssetFromProviderSchema,
  createAssetSchema,
  linkAssetToAccountSchema,
  updateBinanceAccountSettingsSchema
} from "./store.schemas";
import {
  bootstrapStore,
  createAccount,
  createAsset,
  createAssetFromProvider,
  getStore,
  linkAssetToAccount,
  listAccounts,
  listAccountAssetLinks,
  listAssets,
  unlinkAssetFromAccount,
  updateAccountAssetLinkQuantity,
  updateBinanceAccountSettings,
  updateAccountName
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

function parseSingleParam(value: unknown, fieldName: string): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
    return value[0].trim();
  }

  throw new ValidationError(`Invalid ${fieldName}`);
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

export async function createAssetFromProviderHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = createAssetFromProviderSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join(", "));
    }

    const asset = await createAssetFromProvider(parsed.data);

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
    const accountId = parseSingleParam(req.params.accountId, "accountId");

    const parsed = updateBinanceAccountSettingsSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((issue) => issue.message).join(", ")
      );
    }

    const account = await updateBinanceAccountSettings(accountId, parsed.data);

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

export async function updateLinkQuantityHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const linkId = parseSingleParam(req.params.linkId, "linkId");
    const quantity = Number(req.body?.quantity);

    const result = await updateAccountAssetLinkQuantity(linkId, quantity);

    res.json({
      ok: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function unlinkAssetHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const linkId = parseSingleParam(req.params.linkId, "linkId");

    await unlinkAssetFromAccount(linkId);

    res.json({
      ok: true
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAccountNameHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = parseSingleParam(req.params.accountId, "accountId");
    const name = String(req.body?.name ?? "");

    const account = await updateAccountName(accountId, name);

    res.json({
      ok: true,
      data: account
    });
  } catch (error) {
    next(error);
  }
}