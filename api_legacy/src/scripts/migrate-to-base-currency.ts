import dotenv from "dotenv";
import { readStore, writeStore } from "../lib/store.js";
import { convertToUsd } from "../services/fx-rate.service.js";

dotenv.config();

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isLikelyLegacyThbBase(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 10_000;
}

function normalizeCurrency(value?: string) {
  return (value ?? "USD").trim().toUpperCase();
}

function deriveLegacyInputMode(order: any, asset: any) {
  if (order.inputMode === "quantity_price" || order.inputMode === "amount_units") {
    return order.inputMode;
  }

  if (asset?.assetType === "fund") {
    return "amount_units";
  }

  return "quantity_price";
}

function deriveOrderGrossNative(order: any, asset: any) {
  const inputMode = deriveLegacyInputMode(order, asset);
  const quantity = Number(order.quantity ?? 0);

  if (inputMode === "amount_units") {
    const amount = Number(
      order.inputGrossAmount ?? order.derivedGrossAmount ?? order.price ?? 0,
    );

    return Number.isFinite(amount) ? amount : 0;
  }

  if (isPositiveNumber(Number(order.inputGrossAmount ?? 0))) {
    return Number(order.inputGrossAmount);
  }

  const unitPrice = Number(
    order.inputUnitPrice ?? order.derivedUnitPrice ?? order.price ?? 0,
  );

  if (!Number.isFinite(unitPrice) || !Number.isFinite(quantity)) {
    return 0;
  }

  return quantity * unitPrice;
}

function deriveOrderUnitPriceNative(order: any, asset: any, grossNative: number) {
  const inputMode = deriveLegacyInputMode(order, asset);
  const quantity = Number(order.quantity ?? 0);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 0;
  }

  if (inputMode === "amount_units") {
    return grossNative / quantity;
  }

  const explicitUnitPrice = Number(
    order.inputUnitPrice ?? order.derivedUnitPrice ?? order.price ?? 0,
  );

  if (isPositiveNumber(explicitUnitPrice)) {
    return explicitUnitPrice;
  }

  return grossNative / quantity;
}

async function migrateOrders() {
  const store = readStore();
  const assetMap = new Map(store.stockAssets.map((asset: any) => [asset.id, asset]));

  let updated = 0;
  let detectedLegacyBaseCount = 0;

  for (const order of store.stockOrders) {
    const asset = assetMap.get(order.assetId);

    const inputCurrency = normalizeCurrency(
      order.inputCurrency || asset?.currency || order.feeCurrency || "USD",
    );
    const feeCurrency = normalizeCurrency(
      order.feeCurrency || inputCurrency,
    );
    const tradeDate = order.tradeDate;

    const inputMode = deriveLegacyInputMode(order, asset);
    const grossNative = deriveOrderGrossNative(order, asset);
    const unitPriceNative = deriveOrderUnitPriceNative(order, asset, grossNative);
    const feeNative = Number(order.fee ?? order.derivedFeeAmount ?? 0);

    if (isLikelyLegacyThbBase(order.grossAmountBase)) {
      detectedLegacyBaseCount += 1;
    }

    const grossConverted = await convertToUsd(
      Number(grossNative),
      inputCurrency,
      tradeDate,
    );

    const unitConverted = await convertToUsd(
      Number(unitPriceNative),
      inputCurrency,
      tradeDate,
    );

    order.inputMode = inputMode;
    order.inputCurrency = inputCurrency;
    order.inputGrossAmount = grossNative;
    if (inputMode === "quantity_price") {
      order.inputUnitPrice = unitPriceNative;
    }
    order.derivedGrossAmount = grossNative;
    order.derivedUnitPrice = unitPriceNative;
    order.baseCurrency = "USD";

    order.grossAmountBase = grossConverted.amountUsd;
    order.unitPriceBase = unitConverted.amountUsd;
    order.fxRateToBase = grossConverted.fxRate;
    order.fxRateDate = grossConverted.fxDate;
    order.fxSource = grossConverted.source;

    if (feeNative > 0) {
      const feeConverted = await convertToUsd(
        feeNative,
        feeCurrency,
        tradeDate,
      );

      order.feeCurrency = feeCurrency;
      order.derivedFeeAmount = feeNative;
      order.feeAmountBase = feeConverted.amountUsd;
    } else {
      order.feeCurrency = feeCurrency;
      order.derivedFeeAmount = 0;
      order.feeAmountBase = 0;
    }

    updated += 1;
  }

  writeStore(store);

  return {
    updated,
    detectedLegacyBaseCount,
  };
}

async function migratePrices() {
  const store = readStore();
  const assetMap = new Map(store.stockAssets.map((asset: any) => [asset.id, asset]));

  let updated = 0;

  for (const price of store.stockPrices) {
    const asset = assetMap.get(price.assetId);
    const currency = normalizeCurrency(price.currency || asset?.currency || "USD");

    const converted = await convertToUsd(
      Number(price.price ?? 0),
      currency,
      price.priceDate,
    );

    price.currency = currency;
    price.baseCurrency = "USD";
    price.priceBase = converted.amountUsd;
    price.fxRateToBase = converted.fxRate;
    price.fxRateDate = converted.fxDate;
    price.fxSource = converted.source;

    updated += 1;
  }

  writeStore(store);

  return updated;
}

async function run() {
  console.log("🚀 FORCE migration → base currency (USD)");

  const orderResult = await migrateOrders();
  console.log(`✅ Orders updated: ${orderResult.updated}`);
  console.log(
    `🔎 Legacy THB-like grossAmountBase detected: ${orderResult.detectedLegacyBaseCount}`,
  );

  const priceUpdated = await migratePrices();
  console.log(`✅ Prices updated: ${priceUpdated}`);

  console.log("🎉 Migration completed");
}

run().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});