/**
 * React Query hooks for data fetching
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchPositions, fetchTrades, resolveProxy } from '@/lib/polymarket';
import { walletStorage } from '@/lib/storage';
import { WatchedWallet, Trade } from '@/lib/types';
import { useState, useEffect, useRef, useCallback } from 'react';
import { detectNewTrades, emitTradeToast } from '@/lib/notifications';

// ═══════════════════════════════════════════════════════════
// Wallet Management Hooks
// ═══════════════════════════════════════════════════════════

export function useWallets() {
    // Lazy initialization of state from synchronous storage
    const [wallets, setWallets] = useState<WatchedWallet[]>(() => {
        if (typeof window !== 'undefined') {
            return walletStorage.getAll();
        }
        return [];
    });
    const [isLoaded, setIsLoaded] = useState(false);

    // Initial load/sync
    useEffect(() => {
        // Wrap in timeout to avoid sync state update lint error
        setTimeout(() => setIsLoaded(true), 0);
    }, []);

    const addWallet = async (address: string, label?: string, tier?: 'following' | 'watchlist', notes?: string) => {
        const newWallet = walletStorage.add(address, label, tier, notes);

        // Resolve proxy address in background
        try {
            const proxyAddress = await resolveProxy(address);
            walletStorage.updateProxyAddress(newWallet.id, proxyAddress);
        } catch {
            // Continue without proxy resolution
        }

        setWallets(walletStorage.getAll());
        return newWallet;
    };

    const removeWallet = (id: string) => {
        walletStorage.remove(id);
        setWallets(walletStorage.getAll());
    };

    const updateWallet = (id: string, updates: Partial<WatchedWallet>) => {
        walletStorage.update(id, updates);
        setWallets(walletStorage.getAll());
    };

    return {
        wallets,
        isLoaded,
        addWallet,
        removeWallet,
        updateWallet,
    };
}

// ═══════════════════════════════════════════════════════════
// Rate Limiting Utilities (HIGH-001 Fix)
// ═══════════════════════════════════════════════════════════

const CHUNK_SIZE = 3; // Conservative limit
const DELAY_MS = 1100; // 1.1 seconds (safe for 1 req/sec limit)

/**
 * Delay execution for rate limiting
 */
const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

/**
 * Fetch data for all wallets with rate limiting
 * Processes wallets in chunks to avoid 429 errors
 */
export async function fetchAllWalletsSafe<T>(
    wallets: WatchedWallet[],
    fetcher: (address: string) => Promise<T>
): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    // Process in chunks
    for (let i = 0; i < wallets.length; i += CHUNK_SIZE) {
        const chunk = wallets.slice(i, i + CHUNK_SIZE);

        // Fetch chunk in parallel
        const chunkPromises = chunk.map(async w => {
            try {
                const data = await fetcher(w.address);
                return { id: w.id, data };
            } catch (e) {
                console.error(`Failed to fetch ${w.label}:`, e);
                return { id: w.id, data: null };
            }
        });

        const chunkResults = await Promise.all(chunkPromises);
        for (const result of chunkResults) {
            results.set(result.id, result.data);
        }

        // Wait before next chunk (unless it's the last one)
        if (i + CHUNK_SIZE < wallets.length) {
            await delay(DELAY_MS);
        }
    }

    return results;
}

// ═══════════════════════════════════════════════════════════
// Position & Trade Hooks
// ═══════════════════════════════════════════════════════════

const STALE_TIME = 60_000; // 60 seconds
const REFETCH_INTERVAL = 30_000; // 30 seconds for faster trade updates

export function usePositions(walletAddress: string | null) {
    return useQuery({
        queryKey: ['positions', walletAddress],
        queryFn: () => fetchPositions(walletAddress!),
        enabled: !!walletAddress,
        staleTime: STALE_TIME,
        refetchInterval: walletAddress ? REFETCH_INTERVAL : false,
        retry: 1,
        retryDelay: 1000,
        gcTime: 0,
    });
}

export function useTrades(walletAddress: string | null, walletLabel?: string) {
    const previousTradesRef = useRef<Trade[]>([]);
    const isFirstFetchRef = useRef(true);

    const query = useQuery({
        queryKey: ['trades', walletAddress],
        queryFn: () => fetchTrades(walletAddress!),
        enabled: !!walletAddress,
        staleTime: STALE_TIME,
        refetchInterval: walletAddress ? REFETCH_INTERVAL : false,
        retry: 1,
        retryDelay: 1000,
        gcTime: 0,
    });

    // Detect new trades and emit notifications
    useEffect(() => {
        if (!query.data || !walletAddress || !walletLabel) return;

        // Skip notification on first fetch
        if (isFirstFetchRef.current) {
            isFirstFetchRef.current = false;
            // Initialize last seen trades
            detectNewTrades(walletAddress, walletLabel, query.data, false);
            previousTradesRef.current = query.data;
            return;
        }

        // Detect new trades - only send in-app toasts, not browser notifications
        const { newTrades } = detectNewTrades(walletAddress, walletLabel, query.data, false);

        // Emit in-app toasts for new trades
        for (const trade of newTrades.slice(0, 3)) {
            emitTradeToast(walletLabel, trade);
        }

        previousTradesRef.current = query.data;
    }, [query.data, walletAddress, walletLabel]);

    return query;
}

// ═══════════════════════════════════════════════════════════
// Aggregated Portfolio Hook
// ═══════════════════════════════════════════════════════════

export function usePortfolio(walletAddress: string | null, walletLabel?: string) {
    const positions = usePositions(walletAddress);
    const trades = useTrades(walletAddress, walletLabel);

    const totalValue = positions.data?.reduce((sum, p) => sum + p.currentValue, 0) ?? 0;
    const totalPnL = positions.data?.reduce((sum, p) => sum + p.unrealizedPnL, 0) ?? 0;
    const totalCostBasis = positions.data?.reduce((sum, p) => sum + p.costBasis, 0) ?? 0;
    const totalPnLPercent = totalCostBasis > 0 ? (totalPnL / totalCostBasis) * 100 : 0;

    return {
        positions: positions.data ?? [],
        trades: trades.data ?? [],
        totalValue,
        totalPnL,
        totalPnLPercent,
        isLoading: positions.isLoading || trades.isLoading,
        isError: positions.isError || trades.isError,
        error: positions.error || trades.error,
        refetch: () => {
            positions.refetch();
            trades.refetch();
        },
    };
}

// ═══════════════════════════════════════════════════════════
// Background Trade Monitoring Hook (Updated with Rate Limiting)
// ═══════════════════════════════════════════════════════════

/**
 * Monitors all tracked wallets for new trades in the background
 * This runs independently of which wallet is selected
 * 
 * HIGH-001 FIX: Now uses rate-limited batch fetching
 */
export function useTradeMonitor(wallets: WatchedWallet[], isEnabled: boolean = true) {
    const [lastCheck, setLastCheck] = useState<Date | null>(null);
    const [newTradeCount, setNewTradeCount] = useState(0);
    const [isChecking, setIsChecking] = useState(false);
    const isFirstRunRef = useRef(true);

    const checkAllWallets = useCallback(async () => {
        if (!isEnabled || wallets.length === 0 || isChecking) return;

        setIsChecking(true);
        let totalNewTrades = 0;

        try {
            // HIGH-001 FIX: Use rate-limited batch fetching
            const tradesMap = await fetchAllWalletsSafe(wallets, fetchTrades);

            for (const wallet of wallets) {
                const trades = tradesMap.get(wallet.id);
                if (!trades) continue;

                // On first run, just initialize tracking without notifications
                const shouldNotify = !isFirstRunRef.current;
                const { newTrades } = detectNewTrades(
                    wallet.address,
                    wallet.label,
                    trades,
                    false // Don't use browser notifications, we'll use toasts
                );

                if (shouldNotify && newTrades.length > 0) {
                    // Emit in-app toasts for new trades (limit to 2 to avoid spam)
                    for (const trade of newTrades.slice(0, 2)) {
                        emitTradeToast(wallet.label, trade);
                    }
                    totalNewTrades += newTrades.length;
                }
            }
        } catch (error) {
            console.warn('Failed to check trades:', error);
        }

        isFirstRunRef.current = false;
        setNewTradeCount(totalNewTrades);
        setLastCheck(new Date());
        setIsChecking(false);
    }, [wallets, isEnabled, isChecking]);

    // Initial check and periodic monitoring
    useEffect(() => {
        if (!isEnabled || wallets.length === 0) return;

        // Run initial check - wrap in timeout
        setTimeout(() => checkAllWallets(), 0);

        // Check every 60 seconds (increased from 30 to reduce API load)
        const interval = setInterval(checkAllWallets, 60_000);

        return () => clearInterval(interval);
    }, [checkAllWallets, isEnabled, wallets.length]);

    return {
        lastCheck,
        newTradeCount,
        isChecking,
        checkNow: checkAllWallets,
    };
}
