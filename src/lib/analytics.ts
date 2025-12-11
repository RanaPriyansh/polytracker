/**
 * Analytics Engine v2.1
 * Computes trader stats, sector detection, and win rate calculations
 * Implements caching to avoid API spam (6-hour cache)
 * 
 * HOTFIXES APPLIED:
 * - CRIT-001: Market resolution handling for held positions
 * - CRIT-003: Null/undefined field safety checks
 */

import { Trade, TraderStats, Sector, TraderBadge, Position } from './types';
import { walletStorage } from './storage';
import { fetchTrades } from './polymarket';

// ═══════════════════════════════════════════════════════════
// Sector Detection
// ═══════════════════════════════════════════════════════════

const SECTOR_KEYWORDS: Record<Sector, RegExp> = {
    Politics: /trump|harris|biden|election|senate|congress|president|nominee|democrat|republican|vote|governor|poll|white house/i,
    Crypto: /bitcoin|btc|ethereum|eth|solana|sol|crypto|token|nft|blockchain|coinbase|binance|defi|stablecoin|usdc|usdt/i,
    Sports: /nba|nfl|mlb|nhl|premier league|football|basketball|soccer|baseball|hockey|championship|playoffs|super bowl|world cup|vs\.|game \d/i,
    Business: /stock|ipo|company|ceo|earnings|merger|acquisition|nasdaq|dow|s&p|fed|interest rate|inflation|gdp|recession/i,
    Entertainment: /movie|film|oscar|grammy|album|celebrity|actor|actress|music|concert|tv show|streaming|netflix|disney/i,
    Other: /.*/,  // Fallback
};

/**
 * Detect sector from market title with null safety (CRIT-003 fix)
 */
export function detectSector(marketTitle: string | null | undefined): Sector {
    // CRIT-003: Handle null/undefined marketTitle
    if (!marketTitle || typeof marketTitle !== 'string') {
        console.warn('detectSector: Received invalid marketTitle, defaulting to Other');
        return 'Other';
    }

    for (const [sector, regex] of Object.entries(SECTOR_KEYWORDS)) {
        if (sector === 'Other') continue; // Skip fallback
        if (regex.test(marketTitle)) {
            return sector as Sector;
        }
    }
    return 'Other';
}

// ═══════════════════════════════════════════════════════════
// Market Resolution Info (CRIT-001 Fix)
// ═══════════════════════════════════════════════════════════

export interface MarketResolutionInfo {
    conditionId: string;
    isClosed: boolean;
    winningOutcome?: string; // 'YES', 'NO', or specific outcome
}

// ═══════════════════════════════════════════════════════════
// Win Rate Calculation
// ═══════════════════════════════════════════════════════════

interface TradeAnalysis {
    winRate: number;
    profitFactor: number;
    totalVolume: number;
    tradeCount: number;
    sectorBreakdown: Record<Sector, { trades: number; winRate: number }>;
    specialty: Sector;
    recentPnL: number;
    volumeHistory: number[];
}

/**
 * Analyze trades to compute trader statistics
 * 
 * CRIT-001 Fix: Now handles market resolution for held positions
 * CRIT-003 Fix: Safe handling of null/undefined fields
 * 
 * @param trades - List of trades to analyze
 * @param resolutions - Optional map of market resolutions for accurate P/L
 */
export function analyzeTrades(
    trades: Trade[],
    resolutions: Map<string, MarketResolutionInfo> = new Map()
): TradeAnalysis {
    if (trades.length === 0) {
        return getEmptyAnalysis();
    }

    const sectorStats: Record<Sector, { wins: number; losses: number; volume: number }> = {
        Politics: { wins: 0, losses: 0, volume: 0 },
        Crypto: { wins: 0, losses: 0, volume: 0 },
        Sports: { wins: 0, losses: 0, volume: 0 },
        Business: { wins: 0, losses: 0, volume: 0 },
        Entertainment: { wins: 0, losses: 0, volume: 0 },
        Other: { wins: 0, losses: 0, volume: 0 },
    };

    let totalVolume = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let wins = 0;
    let losses = 0;

    // Group trades by market to find matched buy/sell pairs
    const tradesByMarket = new Map<string, Trade[]>();
    for (const trade of trades) {
        const key = `${trade.conditionId}-${trade.outcome}`;
        if (!tradesByMarket.has(key)) {
            tradesByMarket.set(key, []);
        }
        tradesByMarket.get(key)!.push(trade);
    }

    // For each market, calculate PnL
    for (const [, marketTrades] of tradesByMarket) {
        const sector = detectSector(marketTrades[0].marketTitle);
        let buyValue = 0;
        let buyShares = 0;
        let sellValue = 0;
        let sellShares = 0;

        for (const trade of marketTrades) {
            if (trade.side === 'BUY') {
                buyValue += trade.usdcAmount;
                buyShares += trade.size;
            } else {
                sellValue += trade.usdcAmount;
                sellShares += trade.size;
            }
            totalVolume += trade.usdcAmount;
            sectorStats[sector].volume += trade.usdcAmount;
        }

        // Calculate PnL if we have both buy and sell
        if (buyShares > 0 && sellShares > 0) {
            const avgBuyPrice = buyValue / buyShares;
            const avgSellPrice = sellValue / sellShares;
            const pnl = (avgSellPrice - avgBuyPrice) * Math.min(buyShares, sellShares);

            if (pnl > 0) {
                wins++;
                grossProfit += pnl;
                sectorStats[sector].wins++;
            } else {
                losses++;
                grossLoss += Math.abs(pnl);
                sectorStats[sector].losses++;
            }
        }

        // CRIT-001 FIX: Handle held positions with market resolution
        const remainingShares = buyShares - sellShares;
        if (remainingShares > 0) {
            const conditionId = marketTrades[0].conditionId;
            const outcome = marketTrades[0].outcome;
            const resolution = resolutions.get(conditionId);

            if (resolution?.isClosed) {
                // Market has resolved - value at $1 (win) or $0 (loss)
                const isWinner = resolution.winningOutcome === outcome;
                const finalPrice = isWinner ? 1.0 : 0.0;
                const avgBuyPrice = buyValue / buyShares;
                const resolutionPnL = (finalPrice - avgBuyPrice) * remainingShares;

                if (resolutionPnL > 0) {
                    wins++;
                    grossProfit += resolutionPnL;
                    sectorStats[sector].wins++;
                } else {
                    losses++;
                    grossLoss += Math.abs(resolutionPnL);
                    sectorStats[sector].losses++;
                }
            }
            // If market is still open, we don't count it as win or loss
            // This is more accurate than guessing from entry price
        }
    }

    const totalTrades = wins + losses;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 50;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 10 : 1;

    // Calculate sector breakdown
    const sectorBreakdown: Record<Sector, { trades: number; winRate: number }> = {} as any;
    let maxVolumeSector: Sector = 'Other';
    let maxVolume = 0;

    for (const [sector, stats] of Object.entries(sectorStats)) {
        const sectorTotal = stats.wins + stats.losses;
        sectorBreakdown[sector as Sector] = {
            trades: sectorTotal,
            winRate: sectorTotal > 0 ? (stats.wins / sectorTotal) * 100 : 0,
        };
        if (stats.volume > maxVolume) {
            maxVolume = stats.volume;
            maxVolumeSector = sector as Sector;
        }
    }

    // Calculate 7-day volume history (simplified - just split recent volume)
    const volumeHistory: number[] = [];
    const last7Days = trades.filter(t => {
        const tradeDate = new Date(t.timestamp);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return tradeDate >= sevenDaysAgo;
    });

    for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000);
        const dayEnd = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dayVolume = last7Days
            .filter(t => {
                const d = new Date(t.timestamp);
                return d >= dayStart && d < dayEnd;
            })
            .reduce((sum, t) => sum + t.usdcAmount, 0);
        volumeHistory.push(dayVolume);
    }

    // Calculate recent PnL (simplified)
    const recentPnL = grossProfit - grossLoss;

    return {
        winRate,
        profitFactor,
        totalVolume,
        tradeCount: trades.length,
        sectorBreakdown,
        specialty: maxVolumeSector,
        recentPnL,
        volumeHistory,
    };
}

function getEmptyAnalysis(): TradeAnalysis {
    return {
        winRate: 0,
        profitFactor: 0,
        totalVolume: 0,
        tradeCount: 0,
        sectorBreakdown: {
            Politics: { trades: 0, winRate: 0 },
            Crypto: { trades: 0, winRate: 0 },
            Sports: { trades: 0, winRate: 0 },
            Business: { trades: 0, winRate: 0 },
            Entertainment: { trades: 0, winRate: 0 },
            Other: { trades: 0, winRate: 0 },
        },
        specialty: 'Other',
        recentPnL: 0,
        volumeHistory: [0, 0, 0, 0, 0, 0, 0],
    };
}

// ═══════════════════════════════════════════════════════════
// Badge Assignment
// ═══════════════════════════════════════════════════════════

export function assignBadges(analysis: TradeAnalysis): TraderBadge[] {
    const badges: TraderBadge[] = [];

    if (analysis.totalVolume >= 100000) {
        badges.push('Whale');
    }
    if (analysis.winRate >= 65 && analysis.tradeCount >= 10) {
        badges.push('Sniper');
    }
    if (analysis.tradeCount >= 50) {
        badges.push('High Volume');
    }
    if (analysis.winRate >= 70 && analysis.tradeCount >= 5) {
        badges.push('Hot Streak');
    }
    if (analysis.sectorBreakdown[analysis.specialty].trades >= 10) {
        badges.push('Specialist');
    }

    return badges;
}

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
