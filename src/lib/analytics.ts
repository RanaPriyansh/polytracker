/**
 * Analytics Engine v2.2
 * Computes trader stats, sector detection, and win rate calculations
 * Implements caching to avoid API spam (6-hour cache)
 * 
 * PATCHES APPLIED:
 * - K-01: Decimal.js for financial precision
 * - CRIT-001: Market resolution handling for held positions
 * - CRIT-003: Null/undefined field safety checks
 */

import { TraderStats } from './types';
import { walletStorage } from './storage';
import { fetchTrades } from './polymarket';
import { analyzeTrades, assignBadges, detectSector } from './analytics-core';

// Re-export pure functions for backward compatibility if needed,
// though consumers should ideally switch to analytics-core if they want pure logic.
export { analyzeTrades, assignBadges, detectSector };

// ═══════════════════════════════════════════════════════════
// Stats Fetching with Cache
// ═══════════════════════════════════════════════════════════

export async function fetchAndComputeStats(walletId: string, walletAddress: string): Promise<TraderStats> {
    // Check cache first
    if (!walletStorage.isStatsStale(walletId)) {
        const cachedStats = walletStorage.getStats(walletId);
        if (cachedStats) return cachedStats;
    }

    // Fetch fresh trades
    try {
        const trades = await fetchTrades(walletAddress, 100);
        const analysis = analyzeTrades(trades);
        const badges = assignBadges(analysis);

        const stats: TraderStats = {
            lastUpdated: Date.now(),
            winRate: analysis.winRate,
            profitFactor: analysis.profitFactor,
            totalVolume: analysis.totalVolume,
            tradeCount: analysis.tradeCount,
            specialty: analysis.specialty,
            sectorBreakdown: analysis.sectorBreakdown,
            badges,
            recentPnL: analysis.recentPnL,
            volumeHistory: analysis.volumeHistory,
        };

        // Cache the stats
        walletStorage.saveStats(walletId, stats);

        return stats;
    } catch (error) {
        console.warn('Failed to compute stats:', error);
        // Return empty stats on error
        return {
            lastUpdated: Date.now(),
            winRate: 0,
            profitFactor: 0,
            totalVolume: 0,
            tradeCount: 0,
            specialty: 'Other',
            sectorBreakdown: {
                Politics: { trades: 0, winRate: 0 },
                Crypto: { trades: 0, winRate: 0 },
                Sports: { trades: 0, winRate: 0 },
                Business: { trades: 0, winRate: 0 },
                Entertainment: { trades: 0, winRate: 0 },
                Other: { trades: 0, winRate: 0 },
            },
            badges: [],
            recentPnL: 0,
            volumeHistory: [0, 0, 0, 0, 0, 0, 0],
        };
    }
}
