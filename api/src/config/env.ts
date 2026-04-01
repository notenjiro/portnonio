import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BINANCE_API_BASE_URL: z.string().url().default("https://api.binance.com"),
  BINANCE_FAPI_BASE_URL: z.string().url().default("https://fapi.binance.com"),
  TWELVEDATA_API_BASE_URL: z.string().url().default("https://api.twelvedata.com"),
  TWELVEDATA_API_KEY: z.string().optional(),
  SEC_API_BASE_URL: z.string().url().default("https://api.sec.or.th/v2"),
  SEC_API_KEY: z.string().optional()
});

const parsed = envSchema.safeParse({
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  BINANCE_API_BASE_URL: process.env.BINANCE_API_BASE_URL,
  BINANCE_FAPI_BASE_URL: process.env.BINANCE_FAPI_BASE_URL,
  TWELVEDATA_API_BASE_URL: process.env.TWELVEDATA_API_BASE_URL,
  TWELVEDATA_API_KEY: process.env.TWELVEDATA_API_KEY,
  SEC_API_BASE_URL: process.env.SEC_API_BASE_URL,
  SEC_API_KEY: process.env.SEC_API_KEY
});

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;