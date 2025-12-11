/**
 * Data Validation Module
 * Uses Zod for strict runtime validation of API responses
 * 
 * PATCH K-05: Prevents garbage data from breaking the app
 */

import { z } from 'zod';
import { Trade, Position } from './types';

// ═══════════════════════════════════════════════════════════
// Trade Schema (K-05: Reject garbage data)
// ═══════════════════════════════════════════════════════════

export const TradeSchema = z.object({
    id: z.string().optional(),
    transactionHash: z.string().optional(),
    conditionId: z.string(),
    marketSlug: z.string(),
    marketTitle: z.string(),

    // K-05: Reject impossible prices (must be 0-1)
    price: z.number().min(0).max(1),

    // K-05: Reject future timestamps (allow 1 minute buffer)
    timestamp: z.string().refine((val) => {
        const date = new Date(val);
        return !isNaN(date.getTime()) && date.getTime() <= Date.now() + 60000;
    }, { message: 'Invalid or future timestamp' }),

    outcome: z.string(),
    side: z.enum(['BUY', 'SELL']),

    // K-05: Reject negative values
    size: z.number().nonnegative(),
    usdcAmount: z.number().nonnegative(),
});

export const PositionSchema = z.object({
    id: z.string(),
    walletAddress: z.string(),
    proxyWallet: z.string(),
    conditionId: z.string(),
    marketSlug: z.string(),
    marketTitle: z.string(),
    sector: z.string().optional(),
    outcome: z.string(),
    tokenId: z.string(),
    size: z.number().nonnegative(),
    avgEntryPrice: z.number().min(0).max(1),
    currentPrice: z.number().min(0).max(1),
    costBasis: z.number().nonnegative(),
    currentValue: z.number().nonnegative(),
    unrealizedPnL: z.number(),
    unrealizedPnLPercent: z.number(),
    redemptionStatus: z.enum(['ACTIVE', 'RESOLVED', 'REDEEMED']),
    createdAt: z.string(),
    updatedAt: z.string(),
});

// ═══════════════════════════════════════════════════════════
// Safe Parsing Functions
// ═══════════════════════════════════════════════════════════

/**
 * Safely parse trades from API, filtering out corrupted data
 */
export function safeParseTrades(apiResponse: unknown[]): Trade[] {
    const validTrades: Trade[] = [];
    let droppedCount = 0;

    for (const item of apiResponse) {
        const result = TradeSchema.safeParse(item);
        if (result.success) {
            validTrades.push(result.data as Trade);
        } else {
            droppedCount++;
            console.warn('Dropped corrupted trade:', {
                item,
                errors: result.error.flatten().fieldErrors,
            });
        }
    }

    if (droppedCount > 0) {
        console.warn(`Validation: Dropped ${droppedCount}/${apiResponse.length} corrupted trades`);
    }

    return validTrades;
}

/**
 * Safely parse positions from API, filtering out corrupted data
 */
export function safeParsePositions(apiResponse: unknown[]): Position[] {
    const validPositions: Position[] = [];
    let droppedCount = 0;

    for (const item of apiResponse) {
        const result = PositionSchema.safeParse(item);
        if (result.success) {
            validPositions.push(result.data as Position);
        } else {
            droppedCount++;
            console.warn('Dropped corrupted position:', {
                item,
                errors: result.error.flatten().fieldErrors,
            });
        }
    }

    if (droppedCount > 0) {
        console.warn(`Validation: Dropped ${droppedCount}/${apiResponse.length} corrupted positions`);
    }

    return validPositions;
}

// ═══════════════════════════════════════════════════════════
// Validation Helpers
// ═══════════════════════════════════════════════════════════

/**
 * Check if a value is a valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Check if a timestamp is valid and not in the future
 */
export function isValidTimestamp(timestamp: string | number): boolean {
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) && date.getTime() <= Date.now() + 60000;
}

/**
 * Sanitize a number to prevent NaN/Infinity
 */
export function sanitizeNumber(value: unknown, fallback: number = 0): number {
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) {
        return fallback;
    }
    return num;
}
