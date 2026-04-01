import crypto from "node:crypto";
const BINANCE_FUTURES_BASE_URL = process.env.BINANCE_FUTURES_BASE_URL || "https://fapi.binance.com";
function sanitizeAscii(value) {
    return value.replace(/[^\x00-\x7F]/g, "").trim();
}
function buildSignature(queryString, apiSecret) {
    return crypto
        .createHmac("sha256", apiSecret)
        .update(queryString)
        .digest("hex");
}
function buildSignedUrl(pathname, apiSecret, extraParams) {
    const params = new URLSearchParams({
        recvWindow: "5000",
        timestamp: String(Date.now()),
        ...(extraParams ?? {}),
    });
    const queryString = params.toString();
    const signature = buildSignature(queryString, apiSecret);
    return `${BINANCE_FUTURES_BASE_URL}${pathname}?${queryString}&signature=${signature}`;
}
async function getSigned(pathname, apiKey, apiSecret, extraParams) {
    const cleanApiKey = sanitizeAscii(apiKey);
    const cleanApiSecret = sanitizeAscii(apiSecret);
    const url = buildSignedUrl(pathname, cleanApiSecret, extraParams);
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "X-MBX-APIKEY": cleanApiKey,
        },
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Binance Futures API error: ${response.status} ${errorText}`);
    }
    return (await response.json());
}
export async function getBinanceFuturesAccountInfo(apiKey, apiSecret) {
    return getSigned("/fapi/v2/account", apiKey, apiSecret);
}
export async function getBinanceFuturesBalances(apiKey, apiSecret) {
    return getSigned("/fapi/v2/balance", apiKey, apiSecret);
}
export async function getBinanceFuturesPositions(apiKey, apiSecret) {
    return getSigned("/fapi/v3/positionRisk", apiKey, apiSecret);
}
export async function getBinanceFuturesIncomeHistory(apiKey, apiSecret, incomeType, startTime, endTime) {
    const params = {
        incomeType,
        limit: "1000",
    };
    if (startTime)
        params.startTime = String(startTime);
    if (endTime)
        params.endTime = String(endTime);
    return getSigned("/fapi/v1/income", apiKey, apiSecret, params);
}
export function getNonZeroFuturesBalances(balances) {
    return balances.filter((balance) => Number(balance.balance) !== 0);
}
export function getOpenFuturesPositions(positions) {
    return positions.filter((position) => Number(position.positionAmt) !== 0);
}
export function summarizeFuturesAccount(accountInfo) {
    return {
        totalWalletBalance: Number(accountInfo.totalWalletBalance),
        totalUnrealizedProfit: Number(accountInfo.totalUnrealizedProfit),
        totalMarginBalance: Number(accountInfo.totalMarginBalance),
        totalInitialMargin: Number(accountInfo.totalInitialMargin),
        totalMaintMargin: Number(accountInfo.totalMaintMargin),
        availableBalance: Number(accountInfo.availableBalance),
        maxWithdrawAmount: Number(accountInfo.maxWithdrawAmount),
    };
}
