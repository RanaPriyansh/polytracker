/**
 * Polymarket Whale Tracker v2.0 - Type Definitions
 * Intelligence Platform Data Model
 */

// ═══════════════════════════════════════════════════════════
// Tier & Sector System
// ═══════════════════════════════════════════════════════════

/**
 * Tier determines notification intensity and UI prominence
 * - following: Inner Circle - instant alerts, gold styling
 * - watchlist: Radar - daily digest, muted styling
 */
export type Tier = 'following' | 'watchlist';

/**
 * Market sectors for filtering and specialization tracking
 */
export type Sector = 'Politics' | 'Crypto' | 'Sports' | 'Business' | 'Entertainment' | 'Other';

/**
 * Trader badges earned through performance
 */
export type TraderBadge = 'Whale' | 'Sniper' | 'High Volume' | 'Hot Streak' | 'Specialist';

/**
 * Trader performance analytics (cached, refreshed every 6 hours)
 */
export interface TraderStats {
    lastUpdated: number; // Timestamp to prevent API spam
    winRate: number; // % of resolved positions that were profitable
    profitFactor: number; // Gross Profit / Gross Loss
    totalVolume: number; // Total USD volume traded
    tradeCount: number; // Number of trades analyzed
    specialty: Sector; // Sector with highest win rate
    sectorBreakdown: Record<Sector, { trades: number; winRate: number }>;
    badges: TraderBadge[];
    recentPnL: number; // Last 7 days PnL
    volumeHistory: number[]; // Last 7 days volume for sparkline
}

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
    sector?: Sector; // Auto-detected from market title

    // Position
    outcome: string; // 'YES', 'NO', or team names
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
    sector?: Sector; // Auto-detected from market title
    side: "BUY" | "SELL";
    outcome: string;
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

    // Tier System
    tier: Tier;
    notes?: string; // User notes about this trader

    // Analytics (loaded async, cached)
    stats?: TraderStats;

    // Ghost Portfolio
    ghostMode?: boolean; // If true, track simulated copy trading
    ghostStartedAt?: string; // When ghost tracking began

    // Timestamps
    addedAt: string;
    lastSyncedAt: string | null;
}

// ═══════════════════════════════════════════════════════════
// Intelligence Features
// ═══════════════════════════════════════════════════════════

/**
 * Whale Consensus - when multiple tracked traders align on same market
 */
export interface MarketConsensus {
    marketId: string;
    marketSlug: string;
    question: string;
    sector: Sector;
    sentiment: 'Bullish' | 'Bearish'; // Majority YES = Bullish
    outcome: string; // The outcome they're betting on
    traders: Array<{
        walletId: string;
        label: string;
        tier: Tier;
        amount: number;
    }>;
    totalVolume: number;
    strength: number; // 0-100 score based on volume/count
    detectedAt: string;
}

/**
 * Conflict Alert - when a followed trader bets against your position
 */
export interface ConflictAlert {
    id: string;
    marketId: string;
    marketTitle: string;
    yourPosition: { outcome: string; size: number };
    conflictingTrader: { label: string; outcome: string; amount: number };
    detectedAt: string;
    dismissed: boolean;
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

export type ViewMode = 'feed' | 'wallet';
export type FeedFilter = 'all' | Sector;

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
    viewMode: ViewMode;
    feedFilter: FeedFilter;
    isLoading: boolean;
    error: string | null;
}

