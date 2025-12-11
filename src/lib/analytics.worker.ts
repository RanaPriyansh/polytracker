/**
 * Analytics Web Worker
 * Offloads heavy trade analysis to a separate thread
 * 
 * PATCH K-07: Prevents UI freeze on large datasets
 */

import { Trade, TraderStats, Sector, TraderBadge } from './types';
import Decimal from 'decimal.js';

// Configure Decimal for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ═══════════════════════════════════════════════════════════
// Sector Detection
// ═══════════════════════════════════════════════════════════

const SECTOR_KEYWORDS: Record<Sector, RegExp> = {
    Politics: /trump|harris|biden|election|senate|congress|president|nominee|democrat|republican|vote|governor|poll|white house/i,
    Crypto: /bitcoin|btc|ethereum|eth|solana|sol|crypto|token|nft|blockchain|coinbase|binance|defi|stablecoin|usdc|usdt/i,
    Sports: /nba|nfl|mlb|nhl|premier league|football|basketball|soccer|baseball|hockey|championship|playoffs|super bowl|world cup|vs\.|game \d/i,
    Business: /stock|ipo|company|ceo|earnings|merger|acquisition|nasdaq|dow|s&p|fed|interest rate|inflation|gdp|recession/i,
    Entertainment: /movie|film|oscar|grammy|album|celebrity|actor|actress|music|concert|tv show|streaming|netflix|disney/i,
    Other: /.*/,
};

function detectSector(marketTitle: string | null | undefined): Sector {
    if (!marketTitle || typeof marketTitle !== 'string') return 'Other';
    for (const [sector, regex] of Object.entries(SECTOR_KEYWORDS)) {
        if (sector === 'Other') continue;
        if (regex.test(marketTitle)) return sector as Sector;
    }
    return 'Other';
}

// ═══════════════════════════════════════════════════════════
// Precision Math Analysis (K-01 Fix)
// ═══════════════════════════════════════════════════════════

interface MarketResolutionInfo {
    conditionId: string;
    isClosed: boolean;
    winningOutcome?: string;
    resolutionStatus?: 'RESOLVED' | 'INVALID' | 'OPEN';
}

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

function analyzeTrades(
    trades: Trade[],
    resolutions: Map<string, MarketResolutionInfo> = new Map()
): TradeAnalysis {
    if (trades.length === 0) {
        return getEmptyAnalysis();
    }

    const sectorStats: Record<Sector, { wins: number; losses: number; volume: Decimal }> = {
        Politics: { wins: 0, losses: 0, volume: new Decimal(0) },
        Crypto: { wins: 0, losses: 0, volume: new Decimal(0) },
        Sports: { wins: 0, losses: 0, volume: new Decimal(0) },
        Business: { wins: 0, losses: 0, volume: new Decimal(0) },
        Entertainment: { wins: 0, losses: 0, volume: new Decimal(0) },
        Other: { wins: 0, losses: 0, volume: new Decimal(0) },
    };

    let totalVolume = new Decimal(0);
    let grossProfit = new Decimal(0);
    let grossLoss = new Decimal(0);
    let wins = 0;
    let losses = 0;

    // Group trades by market
    const tradesByMarket = new Map<string, Trade[]>();
    for (const trade of trades) {
        const key = `${trade.conditionId}-${trade.outcome}`;
        if (!tradesByMarket.has(key)) {
            tradesByMarket.set(key, []);
        }
        tradesByMarket.get(key)!.push(trade);
    }

    for (const [, marketTrades] of tradesByMarket) {
        const sector = detectSector(marketTrades[0]?.marketTitle);
        let buyValue = new Decimal(0);
        let buyShares = new Decimal(0);
        let sellValue = new Decimal(0);
        let sellShares = new Decimal(0);

        for (const trade of marketTrades) {
            const size = new Decimal(trade.size || 0);
            const amount = new Decimal(trade.usdcAmount || 0);

            if (trade.side === 'BUY') {
                buyValue = buyValue.plus(amount);
                buyShares = buyShares.plus(size);
            } else {
                sellValue = sellValue.plus(amount);
                sellShares = sellShares.plus(size);
            }
            totalVolume = totalVolume.plus(amount);
            sectorStats[sector].volume = sectorStats[sector].volume.plus(amount);
        }

        // Calculate PnL for closed trades
        if (buyShares.gt(0) && sellShares.gt(0)) {
            const avgBuyPrice = buyValue.div(buyShares);
            const avgSellPrice = sellValue.div(sellShares);
            const closedShares = Decimal.min(buyShares, sellShares);
            const pnl = avgSellPrice.minus(avgBuyPrice).times(closedShares);

            if (pnl.gt(0)) {
                wins++;
                grossProfit = grossProfit.plus(pnl);
                sectorStats[sector].wins++;
            } else {
                losses++;
                grossLoss = grossLoss.plus(pnl.abs());
                sectorStats[sector].losses++;
            }
        }

        // Handle held positions with resolution (K-02 fix)
        const remainingShares = buyShares.minus(sellShares);
        if (remainingShares.gt(0)) {
            const conditionId = marketTrades[0].conditionId;
            const outcome = marketTrades[0].outcome;
            const resolution = resolutions.get(conditionId);

            if (resolution?.isClosed && resolution.resolutionStatus === 'RESOLVED') {
                const isWinner = resolution.winningOutcome === outcome;
                const finalPrice = new Decimal(isWinner ? 1 : 0);
                const avgBuyPrice = buyValue.div(buyShares);
                const resolutionPnL = finalPrice.minus(avgBuyPrice).times(remainingShares);

                if (resolutionPnL.gt(0)) {
                    wins++;
                    grossProfit = grossProfit.plus(resolutionPnL);
                    sectorStats[sector].wins++;
                } else {
                    losses++;
                    grossLoss = grossLoss.plus(resolutionPnL.abs());
                    sectorStats[sector].losses++;
                }
            } else if (resolution?.resolutionStatus === 'INVALID') {
                // Invalid markets - don't count as win or loss
                console.warn(`Market ${conditionId} resolved INVALID`);
            }
        }
    }

    const totalTrades = wins + losses;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const profitFactor = grossLoss.gt(0)
        ? grossProfit.div(grossLoss).toNumber()
        : grossProfit.gt(0) ? 10 : 0;

    // Calculate sector breakdown
    const sectorBreakdown: Record<Sector, { trades: number; winRate: number }> = {} as any;
    let maxVolumeSector: Sector = 'Other';
    let maxVolume = new Decimal(0);

    for (const [sector, stats] of Object.entries(sectorStats)) {
        const sectorTotal = stats.wins + stats.losses;
        sectorBreakdown[sector as Sector] = {
            trades: sectorTotal,
            winRate: sectorTotal > 0 ? (stats.wins / sectorTotal) * 100 : 0,
        };
        if (stats.volume.gt(maxVolume)) {
            maxVolume = stats.volume;
            maxVolumeSector = sector as Sector;
        }
    }

    // 7-day volume history
    const volumeHistory = calculateVolumeHistory(trades);
    const recentPnL = grossProfit.minus(grossLoss).toNumber();

    return {
        winRate,
        profitFactor,
        totalVolume: totalVolume.toNumber(),
        tradeCount: trades.length,
        sectorBreakdown,
        specialty: maxVolumeSector,
        recentPnL,
        volumeHistory,
    };
}

function calculateVolumeHistory(trades: Trade[]): number[] {
    const volumeHistory: number[] = [];
    const now = Date.now();

    for (let i = 6; i >= 0; i--) {
        const dayStart = now - (i + 1) * 24 * 60 * 60 * 1000;
        const dayEnd = now - i * 24 * 60 * 60 * 1000;

        let dayVolume = new Decimal(0);
        for (const trade of trades) {
            const tradeTime = new Date(trade.timestamp).getTime();
            if (tradeTime >= dayStart && tradeTime < dayEnd) {
                dayVolume = dayVolume.plus(trade.usdcAmount || 0);
            }
        }
        volumeHistory.push(dayVolume.toNumber());
    }

    return volumeHistory;
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

function assignBadges(analysis: TradeAnalysis): TraderBadge[] {
    const badges: TraderBadge[] = [];

    if (analysis.totalVolume >= 100000) badges.push('Whale');
    if (analysis.winRate >= 65 && analysis.tradeCount >= 10) badges.push('Sniper');
    if (analysis.tradeCount >= 50) badges.push('High Volume');
    if (analysis.winRate >= 70 && analysis.tradeCount >= 5) badges.push('Hot Streak');
    if (analysis.sectorBreakdown[analysis.specialty]?.trades >= 10) badges.push('Specialist');

    return badges;
}

// ═══════════════════════════════════════════════════════════
// Web Worker Message Handler
// ═══════════════════════════════════════════════════════════

self.onmessage = (e: MessageEvent) => {
    const { type, trades, resolutions } = e.data;

    try {
        if (type === 'ANALYZE') {
            const resolutionMap = new Map(resolutions || []);
            const analysis = analyzeTrades(trades, resolutionMap as Map<string, MarketResolutionInfo>);
            const badges = assignBadges(analysis);

            self.postMessage({
                status: 'success',
                result: { ...analysis, badges },
            });
        }
    } catch (error) {
        self.postMessage({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
