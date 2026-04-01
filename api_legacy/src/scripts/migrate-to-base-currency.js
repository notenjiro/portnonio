import dotenv from "dotenv";
import { readStore, writeStore } from "../lib/store.js";
import { convertToUsd } from "../services/fx-rate.service.js";
dotenv.config();
function isValidNumber(n) {
    return typeof n === "number" && Number.isFinite(n);
}
async function migrateOrders() {
    const store = readStore();
    let updated = 0;
    for (const order of store.stockOrders) {
        if (isValidNumber(order.grossAmountBase)) {
            continue;
        }
        const currency = order.inputCurrency ||
            order.feeCurrency ||
            "USD";
        const tradeDate = order.tradeDate;
        // 💥 derive gross
        let gross = 0;
        if (order.inputGrossAmount) {
            gross = Number(order.inputGrossAmount);
        }
        else if (order.inputUnitPrice && order.quantity) {
            gross = Number(order.inputUnitPrice) * Number(order.quantity);
        }
        else if (order.price && order.quantity) {
            gross = Number(order.price) * Number(order.quantity);
        }
        const converted = await convertToUsd(gross, currency, tradeDate);
        order.grossAmountBase = converted.amountUsd;
        order.unitPriceBase =
            order.quantity > 0 ? converted.amountUsd / order.quantity : 0;
        order.fxRateToBase = converted.fxRate;
        order.fxRateDate = converted.fxDate;
        order.fxSource = converted.source;
        // fee
        const fee = Number(order.fee ?? 0);
        if (fee > 0) {
            const feeConv = await convertToUsd(fee, order.feeCurrency || currency, tradeDate);
            order.feeAmountBase = feeConv.amountUsd;
        }
        else {
            order.feeAmountBase = 0;
        }
        updated++;
    }
    writeStore(store);
    return updated;
}
async function migratePrices() {
    const store = readStore();
    let updated = 0;
    for (const price of store.stockPrices) {
        if (isValidNumber(price.priceBase)) {
            continue;
        }
        const currency = price.currency || "USD";
        const converted = await convertToUsd(Number(price.price), currency, price.priceDate);
        price.priceBase = converted.amountUsd;
        price.fxRateToBase = converted.fxRate;
        price.fxRateDate = converted.fxDate;
        price.fxSource = converted.source;
        updated++;
    }
    writeStore(store);
    return updated;
}
async function run() {
    console.log("🚀 Start migration → base currency (USD)");
    const orderUpdated = await migrateOrders();
    console.log(`✅ Orders updated: ${orderUpdated}`);
    const priceUpdated = await migratePrices();
    console.log(`✅ Prices updated: ${priceUpdated}`);
    console.log("🎉 Migration completed");
}
run().catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
});
