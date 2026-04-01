import type {
  BinanceFuturesPosition,
  BinanceSpotHolding
} from "../../providers/provider.types";

export interface PositionsResponse {
  asOf: string | null;
  spot: {
    items: BinanceSpotHolding[];
    count: number;
    totalValueUsd: number;
  };
  futures: {
    items: BinanceFuturesPosition[];
    count: number;
    totalNotionalUsd: number;
    totalUnrealizedPnl: number;
  };
}