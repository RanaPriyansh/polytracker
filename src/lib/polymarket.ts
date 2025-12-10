/**
 * Polymarket API Client
 * Handles all communication with Polymarket APIs with retry logic and error handling
 */

import {
    Position,
    Trade,
    PolymarketPosition,
    PolymarketTrade,
    PolymarketMarket
} from './types';

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

// Extending the imported PolymarketPosition type to include new fields
// In a real scenario, this would typically be done by modifying the `types.ts` file
// or by using declaration merging if the original type is declared globally.
// For the purpose of this exercise, we'll define a local interface that
// represents the *expected* structure from the API after the change.
// This assumes the API now returns 'title' and 'slug' directly in the position object.
export interface PolymarketPositionWithMarketInfo extends PolymarketPosition {
    title?: string; // Market title
    slug?: string;  // Market slug
}

// Similarly for PolymarketTrade
export interface PolymarketTradeWithMarketInfo extends PolymarketTrade {
    title?: string; // Market title
    slug?: string;  // Market slug
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

    // The API now returns title, slug, outcome directly in the response
    const rawPositions = await fetchWithRetry<PolymarketPositionWithMarketInfo[]>(
        `${DATA_API_BASE}/positions?user=${proxyAddress}`
    );

    const positions: Position[] = rawPositions.map((pos) => {
        const size = parseFloat(pos.size) || 0;
        const avgEntryPrice = parseFloat(pos.avgPrice) || 0;
        const currentPrice = parseFloat(pos.curPrice) || 0;
        const currentValue = size * currentPrice;
        const costBasis = size * avgEntryPrice;
        const unrealizedPnL = currentValue - costBasis;
        const unrealizedPnLPercent = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;

        return {
            id: `${pos.conditionId}-${pos.outcomeIndex}`,
            walletAddress,
            proxyWallet: pos.proxyWallet,
            conditionId: pos.conditionId,
            // Use title/slug from API response directly
            marketSlug: pos.slug || pos.conditionId.slice(0, 16),
            marketTitle: pos.title || 'Unknown Market',
            // Use outcome from API (e.g., "Yes", "Eagles") instead of generic YES/NO
            outcome: (pos.outcome || (pos.outcomeIndex === 0 ? 'YES' : 'NO')).toUpperCase(),
            tokenId: pos.asset,
            size,
            avgEntryPrice,
            currentPrice,
            currentValue,
            costBasis,
            unrealizedPnL,
            unrealizedPnLPercent,
            redemptionStatus: pos.redeemable ? 'RESOLVED' : 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    });

    // Filter out resolved/redeemed positions from active view
    return positions.filter(p => p.redemptionStatus === 'ACTIVE');
}

/**
 * Fetch recent trades for a wallet
 * API returns title/slug directly - no need to call getMarketDetails
 */
export async function fetchTrades(walletAddress: string, limit = 50): Promise<Trade[]> {
    const proxyAddress = await resolveProxy(walletAddress);

    // The API returns title, slug directly in the response
    const rawTrades = await fetchWithRetry<PolymarketTradeWithMarketInfo[]>(
        `${DATA_API_BASE}/trades?user=${proxyAddress}&limit=${limit}`
    );

    const trades: Trade[] = rawTrades.map((trade) => {
        // Timestamp is Unix epoch in seconds - convert to ISO string
        const timestampMs = typeof trade.timestamp === 'number'
            ? trade.timestamp * 1000
            : parseInt(trade.timestamp) * 1000;

        return {
            id: trade.id,
            walletAddress,
            conditionId: trade.conditionId,
            // Use title/slug from API response directly
            marketSlug: trade.slug || trade.conditionId.slice(0, 16),
            marketTitle: trade.title || 'Unknown Market',
            side: trade.side.toUpperCase() as 'BUY' | 'SELL',
            outcome: trade.outcome.toUpperCase(),
            size: parseFloat(String(trade.size)) || 0,
            price: parseFloat(String(trade.price)) || 0,
            usdcAmount: (parseFloat(String(trade.size)) || 0) * (parseFloat(String(trade.price)) || 0),
            timestamp: new Date(timestampMs).toISOString(),
            txHash: trade.transactionHash,
            blockNumber: trade.blockNumber,
        };
    });

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
