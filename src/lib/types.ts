/**
 * Polymarket Whale Tracker - Type Definitions
 */

// ═══════════════════════════════════════════════════════════
// Core Entities
// ═══════════════════════════════════════════════════════════

export interface Position {
    id: string;
    walletAddress: string;
    proxyWallet: string;

    // Market
    conditionId: string;
    marketSlug: string;
    marketTitle: string;

    // Position
    outcome: string; // Can be 'YES', 'NO', 'Eagles', 'Chargers', etc.
    tokenId: string;
    size: number;
    avgEntryPrice: number;

    // Valuation
    currentPrice: number;
    currentValue: number;
    costBasis: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;

    // Status
    redemptionStatus: "ACTIVE" | "RESOLVED" | "REDEEMED";

    // Timestamps
    createdAt: string;
    updatedAt: string;
}

export interface Trade {
    id: string;
    walletAddress: string;
    conditionId: string;
    marketSlug: string;
    marketTitle: string;
    side: "BUY" | "SELL";
    outcome: string; // Can be 'YES', 'NO', or team names like 'Eagles'
    size: number;
    price: number;
    usdcAmount: number;
    timestamp: string;
    txHash: string;
    blockNumber: number;
}

export interface WatchedWallet {
    id: string;
    address: string;
    proxyAddress: string | null;
    label: string;
    addedAt: string;
    lastSyncedAt: string | null;
}

// ═══════════════════════════════════════════════════════════
// API Response Types (from Polymarket Data-API)
// ═══════════════════════════════════════════════════════════

export interface PolymarketPosition {
    proxyWallet: string;
    asset: string;
    conditionId: string;
    size: string;
    avgPrice: string;
    initialValue: string;
    currentValue: string;
    cashPnl: string;
    percentPnl: string;
    outcome: string;
    outcomeIndex: number;
    curPrice: string;
    redeemable: boolean;
    mergeable: boolean;
}

export interface PolymarketTrade {
    id: string;
    taker: string;
    maker: string;
    proxyWallet: string;
    conditionId: string;
    outcome: string;
    side: string;
    price: string;
    size: string;
    timestamp: string;
    transactionHash: string;
    blockNumber: number;
}

export interface PolymarketMarket {
    id: string;
    question: string;
    conditionId: string;
    slug: string;
    resolutionSource: string;
    endDate: string;
    liquidity: string;
    volume: string;
    outcomes: string[];
    outcomePrices: string[];
    clobTokenIds: string[];
    active: boolean;
    closed: boolean;
}

// ═══════════════════════════════════════════════════════════
// UI State Types
// ═══════════════════════════════════════════════════════════

export interface WalletPortfolio {
    wallet: WatchedWallet;
    positions: Position[];
    recentTrades: Trade[];
    totalValue: number;
    totalPnL: number;
    totalPnLPercent: number;
    lastUpdated: string;
}

export interface AppState {
    wallets: WatchedWallet[];
    selectedWalletId: string | null;
    isLoading: boolean;
    error: string | null;
}
