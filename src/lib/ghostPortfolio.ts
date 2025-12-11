/**
 * Ghost Portfolio Module
 * Tracks simulated copy-trading performance
 * 
 * CRIT-002 FIX: Filters trades by ghostStartedAt timestamp
 */

import { WatchedWallet, Trade, Position, Sector } from './types';
import { detectSector } from './analytics';

// ═══════════════════════════════════════════════════════════
// Ghost Trade Filtering (CRIT-002 Fix)
// ═══════════════════════════════════════════════════════════

/**
 * Get only trades that occurred AFTER ghost mode was enabled
 * This prevents false P/L from trades made before user started tracking
 */
export function getGhostTrades(wallet: WatchedWallet, allTrades: Trade[]): Trade[] {
    if (!wallet.ghostMode || !wallet.ghostStartedAt) {
        return [];
    }

    const startTime = new Date(wallet.ghostStartedAt).getTime();

    return allTrades.filter(trade => {
        const tradeTime = new Date(trade.timestamp).getTime();
        // Only include trades that happened AFTER ghost mode was enabled
        return tradeTime >= startTime;
    });
}

// ═══════════════════════════════════════════════════════════
// Ghost Portfolio P/L Calculation
// ═══════════════════════════════════════════════════════════

export interface GhostPosition {
    conditionId: string;
    outcome: string;
    marketTitle: string;
    sector: Sector;
    shares: number;
    avgEntryPrice: number;
    totalCost: number;
    currentValue: number;
    unrealizedPnL: number;
    trades: Trade[];
}

export interface GhostPortfolioSummary {
    walletId: string;
    walletLabel: string;
    ghostStartedAt: string;
    totalInvested: number;
    totalReturns: number;
    realizedPnL: number;
    unrealizedPnL: number;
    totalPnL: number;
    positions: GhostPosition[];
    tradeCount: number;
}

/**
 * Build ghost portfolio from filtered trades
 */
export function buildGhostPortfolio(
    wallet: WatchedWallet,
    trades: Trade[],
    currentPrices: Map<string, number> = new Map()
): GhostPortfolioSummary {
    const ghostTrades = getGhostTrades(wallet, trades);

    if (!wallet.ghostStartedAt) {
        return getEmptyGhostPortfolio(wallet);
    }

    // Group trades by market-outcome
    const positionMap = new Map<string, {
        buys: Trade[];
        sells: Trade[];
        marketTitle: string;
        conditionId: string;
        outcome: string;
    }>();

    for (const trade of ghostTrades) {
        const key = `${trade.conditionId}-${trade.outcome}`;

        if (!positionMap.has(key)) {
            positionMap.set(key, {
                buys: [],
                sells: [],
                marketTitle: trade.marketTitle,
                conditionId: trade.conditionId,
                outcome: trade.outcome,
            });
        }

        const pos = positionMap.get(key)!;
        if (trade.side === 'BUY') {
            pos.buys.push(trade);
        } else {
            pos.sells.push(trade);
        }
    }

    // Calculate each position
    const positions: GhostPosition[] = [];
    let totalInvested = 0;
    let totalReturns = 0;
    let realizedPnL = 0;

    for (const [key, data] of positionMap) {
        const buyShares = data.buys.reduce((sum, t) => sum + t.size, 0);
        const buyValue = data.buys.reduce((sum, t) => sum + t.usdcAmount, 0);
        const sellShares = data.sells.reduce((sum, t) => sum + t.size, 0);
        const sellValue = data.sells.reduce((sum, t) => sum + t.usdcAmount, 0);

        const remainingShares = buyShares - sellShares;
        const avgEntryPrice = buyShares > 0 ? buyValue / buyShares : 0;

        totalInvested += buyValue;
        totalReturns += sellValue;

        // Realized P/L from closed portion
        if (sellShares > 0 && buyShares > 0) {
            const closedShares = Math.min(buyShares, sellShares);
            const avgSellPrice = sellValue / sellShares;
            realizedPnL += (avgSellPrice - avgEntryPrice) * closedShares;
        }

        // Current value of remaining shares
        const currentPrice = currentPrices.get(key) ?? avgEntryPrice;
        const currentValue = remainingShares * currentPrice;
        const unrealizedPnL = currentValue - (remainingShares * avgEntryPrice);

        if (remainingShares > 0 || sellShares > 0) {
            positions.push({
                conditionId: data.conditionId,
                outcome: data.outcome,
                marketTitle: data.marketTitle,
                sector: detectSector(data.marketTitle),
                shares: remainingShares,
                avgEntryPrice,
                totalCost: remainingShares * avgEntryPrice,
                currentValue,
                unrealizedPnL,
                trades: [...data.buys, ...data.sells],
            });
        }
    }

    const unrealizedPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);

    return {
        walletId: wallet.id,
        walletLabel: wallet.label,
        ghostStartedAt: wallet.ghostStartedAt,
        totalInvested,
        totalReturns,
        realizedPnL,
        unrealizedPnL,
        totalPnL: realizedPnL + unrealizedPnL,
        positions,
        tradeCount: ghostTrades.length,
    };
}

function getEmptyGhostPortfolio(wallet: WatchedWallet): GhostPortfolioSummary {
    return {
        walletId: wallet.id,
        walletLabel: wallet.label,
        ghostStartedAt: wallet.ghostStartedAt || new Date().toISOString(),
        totalInvested: 0,
        totalReturns: 0,
        realizedPnL: 0,
        unrealizedPnL: 0,
        totalPnL: 0,
        positions: [],
        tradeCount: 0,
    };
}

// ═══════════════════════════════════════════════════════════
// Ghost Mode Controls
// ═══════════════════════════════════════════════════════════

/**
 * Enable ghost mode for a wallet (sets the start timestamp)
 */
export function enableGhostMode(wallet: WatchedWallet): WatchedWallet {
    return {
        ...wallet,
        ghostMode: true,
        ghostStartedAt: new Date().toISOString(),
    };
}

/**
 * Disable ghost mode for a wallet
 */
export function disableGhostMode(wallet: WatchedWallet): WatchedWallet {
    return {
        ...wallet,
        ghostMode: false,
        // Keep ghostStartedAt for historical reference
    };
}
