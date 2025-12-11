/**
 * Polymarket API Client
 * Handles all communication with Polymarket APIs with retry logic and error handling
 */

import { Decimal } from 'decimal.js';
import {
    Position,
    Trade,
    PolymarketMarket
} from './types';
import { PolymarketPositionAPISchema, PolymarketTradeAPISchema } from './api-schemas';

// ═══════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════

const DATA_API_BASE = 'https://data-api.polymarket.com';
const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';
const CLOB_API_BASE = 'https://clob.polymarket.com';

const DEFAULT_TIMEOUT = 5000; // 5 seconds
const MAX_RETRIES = 1; // Reduced retries for faster failure

// ═══════════════════════════════════════════════════════════
// Retry Logic with Exponential Backoff
// ═══════════════════════════════════════════════════════════

interface FetchOptions extends RequestInit {
    timeout?: number;
}

class APIError extends Error {
    constructor(
        message: string,
        public statusCode: number,
        public endpoint: string
    ) {
        super(message);
        this.name = 'APIError';
    }
}

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry<T>(
    url: string,
    options: FetchOptions = {},
    retries = MAX_RETRIES
): Promise<T> {
    const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'PolyTracker/1.0',
                    ...fetchOptions.headers,
                },
            });

            clearTimeout(timeoutId);

            if (response.status === 429) {
                // Rate limited - exponential backoff
                const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000);
                console.warn(`Rate limited on ${url}, retrying in ${backoffMs}ms...`);
                await sleep(backoffMs);
                continue;
            }

            if (!response.ok) {
                throw new APIError(
                    `HTTP ${response.status}: ${response.statusText}`,
                    response.status,
                    url
                );
            }

            return await response.json();
        } catch (error) {
            if (attempt === retries) {
                throw error;
            }

            const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000);
            console.warn(`Request failed for ${url}, attempt ${attempt + 1}/${retries + 1}, retrying in ${backoffMs}ms...`);
            await sleep(backoffMs);
        }
    }

    throw new Error(`Failed to fetch ${url} after ${retries + 1} attempts`);
}

// ═══════════════════════════════════════════════════════════
// EOA to Proxy Address Resolution
// ═══════════════════════════════════════════════════════════

interface UserProfile {
    proxyWallet?: string;
    address?: string;
}

/**
 * Resolves an EOA address to its Polymarket proxy wallet address.
 * Users input MetaMask addresses, but positions are held in Gnosis Safe proxies.
 */
export async function resolveProxy(userAddress: string): Promise<string> {
    try {
        // Try to get user profile which contains proxy wallet
        const users = await fetchWithRetry<UserProfile[]>(
            `${DATA_API_BASE}/users?address=${userAddress.toLowerCase()}`
        );

        if (users && users.length > 0 && users[0].proxyWallet) {
            return users[0].proxyWallet;
        }

        // If no proxy found, the address might already be a proxy
        // or the user hasn't created a Polymarket account
        return userAddress;
    } catch (error) {
        console.warn(`Could not resolve proxy for ${userAddress}, using EOA directly`);
        return userAddress;
    }
}

// ═══════════════════════════════════════════════════════════
// Data Fetching Functions
// ═══════════════════════════════════════════════════════════

/**
 * Fetch positions for a wallet address
 * API returns title/slug directly - no need to call getMarketDetails
 */
export async function fetchPositions(walletAddress: string): Promise<Position[]> {
    const proxyAddress = await resolveProxy(walletAddress);

    const rawPositions = await fetchWithRetry<unknown[]>(
        `${DATA_API_BASE}/positions?user=${proxyAddress}`
    );

    const positions: Position[] = [];

    for (const rawPos of rawPositions) {
        const result = PolymarketPositionAPISchema.safeParse(rawPos);
        if (!result.success) {
            console.warn(`Skipping invalid position for ${walletAddress}:`, result.error);
            continue;
        }
        const pos = result.data;

        // Use Decimal.js for money math
        const size = new Decimal(pos.size || 0);
        const avgEntryPrice = new Decimal(pos.avgPrice || 0);
        const currentPrice = new Decimal(pos.curPrice || 0);

        const currentValue = size.times(currentPrice);
        const costBasis = size.times(avgEntryPrice);
        const unrealizedPnL = currentValue.minus(costBasis);

        let unrealizedPnLPercent = new Decimal(0);
        if (costBasis.gt(0)) {
            unrealizedPnLPercent = unrealizedPnL.div(costBasis).times(100);
        }

        positions.push({
            id: `${pos.conditionId}-${pos.outcomeIndex}`,
            walletAddress,
            proxyWallet: pos.proxyWallet,
            conditionId: pos.conditionId,
            marketSlug: pos.slug || pos.conditionId.slice(0, 16),
            marketTitle: pos.title || 'Unknown Market',
            outcome: (pos.outcome || (pos.outcomeIndex === 0 ? 'YES' : 'NO')).toUpperCase(),
            tokenId: pos.asset,
            size: size.toNumber(),
            avgEntryPrice: avgEntryPrice.toNumber(),
            currentPrice: currentPrice.toNumber(),
            currentValue: currentValue.toNumber(),
            costBasis: costBasis.toNumber(),
            unrealizedPnL: unrealizedPnL.toNumber(),
            unrealizedPnLPercent: unrealizedPnLPercent.toNumber(),
            redemptionStatus: pos.redeemable ? 'RESOLVED' : 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    }

    // Filter out resolved/redeemed positions from active view
    return positions.filter(p => p.redemptionStatus === 'ACTIVE');
}

/**
 * Fetch recent trades for a wallet
 * API returns title/slug directly - no need to call getMarketDetails
 */
export async function fetchTrades(walletAddress: string, limit = 50): Promise<Trade[]> {
    const proxyAddress = await resolveProxy(walletAddress);

    const rawTrades = await fetchWithRetry<unknown[]>(
        `${DATA_API_BASE}/trades?user=${proxyAddress}&limit=${limit}`
    );

    const trades: Trade[] = [];

    for (const rawTrade of rawTrades) {
        const result = PolymarketTradeAPISchema.safeParse(rawTrade);
        if (!result.success) {
            console.warn(`Skipping invalid trade for ${walletAddress}:`, result.error);
            continue;
        }
        const trade = result.data;

        // Timestamp conversion
        const timestampMs = typeof trade.timestamp === 'number'
            ? trade.timestamp * 1000
            : parseInt(trade.timestamp) * 1000;

        // Use Decimal.js for math
        const size = new Decimal(trade.size || 0);
        const price = new Decimal(trade.price || 0);
        const usdcAmount = size.times(price);

        trades.push({
            id: trade.id || `trade-${timestampMs}-${trade.transactionHash}`,
            walletAddress,
            conditionId: trade.conditionId,
            marketSlug: trade.slug || trade.conditionId.slice(0, 16),
            marketTitle: trade.title || 'Unknown Market',
            side: trade.side.toUpperCase() as 'BUY' | 'SELL',
            outcome: trade.outcome.toUpperCase(),
            size: size.toNumber(),
            price: price.toNumber(),
            usdcAmount: usdcAmount.toNumber(),
            timestamp: new Date(timestampMs).toISOString(),
            txHash: trade.transactionHash,
            blockNumber: trade.blockNumber,
        });
    }

    return trades;
}

// ═══════════════════════════════════════════════════════════
// Market Data
// ═══════════════════════════════════════════════════════════

// Cache market details to avoid repeated API calls
const marketCache = new Map<string, PolymarketMarket>();

async function getMarketDetails(conditionId: string): Promise<PolymarketMarket | null> {
    if (marketCache.has(conditionId)) {
        return marketCache.get(conditionId)!;
    }

    try {
        const markets = await fetchWithRetry<PolymarketMarket[]>(
            `${GAMMA_API_BASE}/markets?condition_id=${conditionId}`
        );

        if (markets && markets.length > 0) {
            marketCache.set(conditionId, markets[0]);
            return markets[0];
        }
    } catch (error) {
        console.warn(`Could not fetch market details for ${conditionId}`);
    }

    return null;
}

/**
 * Fetch current price for a token
 */
export async function fetchPrice(tokenId: string): Promise<number> {
    try {
        const data = await fetchWithRetry<{ mid: string }>(
            `${CLOB_API_BASE}/midpoint?token_id=${tokenId}`
        );
        return parseFloat(data.mid) || 0;
    } catch {
        return 0;
    }
}

/**
 * Fetch portfolio value for a wallet
 */
export async function fetchPortfolioValue(walletAddress: string): Promise<number> {
    const proxyAddress = await resolveProxy(walletAddress);

    try {
        const data = await fetchWithRetry<{ value: string }>(
            `${DATA_API_BASE}/value?user=${proxyAddress}`
        );
        return parseFloat(data.value) || 0;
    } catch {
        return 0;
    }
}
