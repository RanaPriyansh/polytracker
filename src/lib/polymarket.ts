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

const DEFAULT_TIMEOUT = 10000;
const MAX_RETRIES = 3;

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
 */
export async function fetchPositions(walletAddress: string): Promise<Position[]> {
    const proxyAddress = await resolveProxy(walletAddress);

    const rawPositions = await fetchWithRetry<PolymarketPosition[]>(
        `${DATA_API_BASE}/positions?user=${proxyAddress}`
    );

    // Fetch market details for each position
    const positions: Position[] = await Promise.all(
        rawPositions.map(async (pos) => {
            const market = await getMarketDetails(pos.conditionId);

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
                marketSlug: market?.slug || pos.conditionId.slice(0, 16),
                marketTitle: market?.question || 'Unknown Market',
                outcome: pos.outcomeIndex === 0 ? 'YES' : 'NO',
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
        })
    );

    // Filter out resolved/redeemed positions from active view
    return positions.filter(p => p.redemptionStatus === 'ACTIVE');
}

/**
 * Fetch recent trades for a wallet
 */
export async function fetchTrades(walletAddress: string, limit = 20): Promise<Trade[]> {
    const proxyAddress = await resolveProxy(walletAddress);

    const rawTrades = await fetchWithRetry<PolymarketTrade[]>(
        `${DATA_API_BASE}/trades?user=${proxyAddress}&limit=${limit}`
    );

    const trades: Trade[] = await Promise.all(
        rawTrades.map(async (trade) => {
            const market = await getMarketDetails(trade.conditionId);

            return {
                id: trade.id,
                walletAddress,
                conditionId: trade.conditionId,
                marketSlug: market?.slug || trade.conditionId.slice(0, 16),
                marketTitle: market?.question || 'Unknown Market',
                side: trade.side.toUpperCase() as 'BUY' | 'SELL',
                outcome: trade.outcome.toUpperCase() as 'YES' | 'NO',
                size: parseFloat(trade.size) || 0,
                price: parseFloat(trade.price) || 0,
                usdcAmount: (parseFloat(trade.size) || 0) * (parseFloat(trade.price) || 0),
                timestamp: trade.timestamp,
                txHash: trade.transactionHash,
                blockNumber: trade.blockNumber,
            };
        })
    );

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
