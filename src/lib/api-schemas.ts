
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════
// Raw API Response Schemas
// ═══════════════════════════════════════════════════════════

export const PolymarketPositionAPISchema = z.object({
    conditionId: z.string(),
    outcomeIndex: z.number().int().nonnegative().optional().default(0), // Sometimes missing, default 0
    asset: z.string(), // Token ID
    size: z.string(), // String number
    avgPrice: z.string(), // String number
    curPrice: z.string().optional().default("0"), // String number
    redeemable: z.boolean().optional(),
    proxyWallet: z.string(),
    // API v2 fields (often included now)
    title: z.string().optional(),
    slug: z.string().optional(),
    outcome: z.string().optional(),
}).passthrough(); // Allow extra fields

export const PolymarketTradeAPISchema = z.object({
    id: z.string().optional(),
    transactionHash: z.string(),
    blockNumber: z.number().int(),
    conditionId: z.string(),
    side: z.string(), // "BUY" or "SELL"
    outcome: z.string(),
    size: z.union([z.string(), z.number()]), // API inconsistent
    price: z.union([z.string(), z.number()]), // API inconsistent
    timestamp: z.union([z.string(), z.number()]), // Unix or ISO
    // API v2 fields
    title: z.string().optional(),
    slug: z.string().optional(),
    asset: z.string().optional(),
}).passthrough();
