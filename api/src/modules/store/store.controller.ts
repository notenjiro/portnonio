import type { NextFunction, Request, Response } from "express";
import { ValidationError } from "../../shared/errors";
import {
  createAccountSchema,
  createAssetFromProviderSchema,
  createAssetSchema,
  linkAssetToAccountSchema,
  updateBinanceAccountSettingsSchema,
  createTransactionSchema,
  updateTransactionSchema
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
  updateAccountName,
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction
} from "./store.service";

/**
 * -----------------------------
 * HELPERS
 * -----------------------------
 */

function parseSourceQuery(value: unknown): "binance" | "stock" | "fund" | undefined {
  if (value === undefined) return undefined;
  if (value === "binance" || value === "stock" || value === "fund") return value;
  throw new ValidationError("Invalid source filter");
}

function parseSingleParam(value: unknown, fieldName: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();

  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
    return value[0].trim();
  }

  throw new ValidationError(`Invalid ${fieldName}`);
}

/**
 * -----------------------------
 * STORE CORE
 * -----------------------------
 */

export async function getStoreHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const store = await getStore();
    res.json({ ok: true, data: store });
  } catch (error) {
    next(error);
  }
}

export async function bootstrapStoreHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const store = await bootstrapStore();
    res.status(201).json({ ok: true, data: store });
  } catch (error) {
    next(error);
  }
}

/**
 * -----------------------------
 * ACCOUNT / ASSET
 * -----------------------------
 */

export async function listAccountsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const source = parseSourceQuery(req.query.source);
    const accounts = await listAccounts(source);

    res.json({ ok: true, data: accounts });
  } catch (error) {
    next(error);
  }
}

export async function listAssetsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const source = parseSourceQuery(req.query.source);
    const assets = await listAssets(source);

    res.json({ ok: true, data: assets });
  } catch (error) {
    next(error);
  }
}

export async function listAccountAssetLinksHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = typeof req.query.accountId === "string" ? req.query.accountId : undefined;
    const links = await listAccountAssetLinks(accountId);

    res.json({ ok: true, data: links });
  } catch (error) {
    next(error);
  }
}

export async function createAccountHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(", "));
    }

    const account = await createAccount(parsed.data);
    res.status(201).json({ ok: true, data: account });
  } catch (error) {
    next(error);
  }
}

export async function createAssetHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createAssetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(", "));
    }

    const asset = await createAsset(parsed.data);
    res.status(201).json({ ok: true, data: asset });
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
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(", "));
    }

    const asset = await createAssetFromProvider(parsed.data);
    res.status(201).json({ ok: true, data: asset });
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
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(", "));
    }

    const account = await updateBinanceAccountSettings(accountId, parsed.data);
    res.json({ ok: true, data: account });
  } catch (error) {
    next(error);
  }
}

/**
 * -----------------------------
 * LINKS
 * -----------------------------
 */

export async function linkAssetToAccountHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = linkAssetToAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(", "));
    }

    const link = await linkAssetToAccount(parsed.data);
    res.status(201).json({ ok: true, data: link });
  } catch (error) {
    next(error);
  }
}

export async function updateLinkQuantityHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const linkId = parseSingleParam(req.params.linkId, "linkId");
    const quantity = Number(req.body?.quantity);

    const result = await updateAccountAssetLinkQuantity(linkId, quantity);

    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function unlinkAssetHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const linkId = parseSingleParam(req.params.linkId, "linkId");

    await unlinkAssetFromAccount(linkId);

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function updateAccountNameHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = parseSingleParam(req.params.accountId, "accountId");
    const name = String(req.body?.name ?? "");

    const account = await updateAccountName(accountId, name);

    res.json({ ok: true, data: account });
  } catch (error) {
    next(error);
  }
}

/**
 * -----------------------------
 * 🔥 TRANSACTION API
 * -----------------------------
 */

export async function listTransactionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = typeof req.query.accountId === "string" ? req.query.accountId : undefined;

    const result = await listTransactions(accountId);

    res.json({
      ok: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function createTransactionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createTransactionSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map(i => i.message).join(", "));
    }

    const tx = await createTransaction(parsed.data);

    res.status(201).json({
      ok: true,
      data: tx
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTransactionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = updateTransactionSchema.safeParse({
      ...req.body,
      id: req.params.id
    });

    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map(i => i.message).join(", "));
    }

    const tx = await updateTransaction(parsed.data);

    res.json({
      ok: true,
      data: tx
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteTransactionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseSingleParam(req.params.id, "transactionId");

    await deleteTransaction(id);

    res.json({
      ok: true
    });
  } catch (error) {
    next(error);
  }
}