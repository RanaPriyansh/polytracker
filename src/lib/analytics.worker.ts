/**
 * Web Worker for heavy analytics computations
 * 
 * PATCHES APPLIED:
 * - CRIT-004: Off-main-thread processing for performance
 */

import { analyzeTrades, assignBadges } from './analytics-core';
import { Trade, TraderStats } from './types';

// Define the message types for type safety
type WorkerMessage =
    | { type: 'ANALYZE_TRADES'; payload: { walletId: string; trades: Trade[] } }
    | { type: 'PING' };

// Define response types
type WorkerResponse =
    | { type: 'ANALYSIS_COMPLETE'; payload: { walletId: string; stats: TraderStats } }
    | { type: 'ERROR'; payload: { message: string } }
    | { type: 'PONG' };

// ═══════════════════════════════════════════════════════════
// Worker Event Handler
// ═══════════════════════════════════════════════════════════

// Fix: Use self as any to satisfy TS worker scope
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const ctx: Worker = self as any;

ctx.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const { type } = event.data;

    try {
        if (type === 'ANALYZE_TRADES') {
            // Fix: Narrow the type or cast carefully
            const payload = (event.data as { payload: { walletId: string; trades: Trade[] } }).payload;
            const { walletId, trades } = payload;

            // Perform heavy computation off-thread
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

            const response: WorkerResponse = {
                type: 'ANALYSIS_COMPLETE',
                payload: { walletId, stats },
            };

            ctx.postMessage(response);
        } else if (type === 'PING') {
            ctx.postMessage({ type: 'PONG' });
        }
    } catch (error) {
        ctx.postMessage({
            type: 'ERROR',
            payload: { message: error instanceof Error ? error.message : 'Unknown worker error' },
        });
    }
};

// Export empty to treat as module
export {};
