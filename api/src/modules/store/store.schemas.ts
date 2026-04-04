import { z } from "zod";

export const accountSourceSchema = z.enum(["binance", "stock", "fund"]);
export const assetCategorySchema = z.enum(["crypto", "stock", "fund"]);

export const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(100),
  source: accountSourceSchema,
  provider: z.string().trim().min(1).max(100)
});

export const createAssetSchema = z.object({
  symbol: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  source: accountSourceSchema,
  category: assetCategorySchema,
  currency: z.string().trim().min(1).max(10).transform((value) => value.toUpperCase())
});

export const createAssetFromProviderSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("twelvedata"),
    symbol: z.string().trim().min(1).max(50),
    name: z.string().trim().min(1).max(200),
    exchange: z.string().trim().min(1).max(100).nullable().optional(),
    currency: z.string().trim().min(1).max(10).transform((value) => value.toUpperCase())
  }),
  z.object({
    provider: z.literal("sec"),
    symbol: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(200),
    projId: z.string().trim().min(1).max(100),
    currency: z.string().trim().min(1).max(10).transform((value) => value.toUpperCase())
  })
]);

export const updateBinanceAccountSettingsSchema = z.object({
  apiKey: z.string().trim().min(1).max(200),
  apiSecret: z.string().trim().min(1).max(200),
  isTestnet: z.boolean().default(false),
  permissions: z.array(z.string().trim().min(1).max(100)).default([]),
  label: z.string().trim().min(1).max(100).optional()
});

export const linkAssetToAccountSchema = z.object({
  accountId: z.string().trim().uuid(),
  assetId: z.string().trim().uuid(),
  quantity: z.number().positive().optional()
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type CreateAssetFromProviderInput = z.infer<typeof createAssetFromProviderSchema>;
export type UpdateBinanceAccountSettingsInput = z.infer<typeof updateBinanceAccountSettingsSchema>;
export type LinkAssetToAccountInput = z.infer<typeof linkAssetToAccountSchema>;