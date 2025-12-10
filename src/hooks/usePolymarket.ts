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
    const [wallets, setWallets] = useState<WatchedWallet[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        setWallets(walletStorage.getAll());
        setIsLoaded(true);
    }, []);

    const addWallet = async (address: string, label?: string) => {
        const newWallet = walletStorage.add(address, label);

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
// Background Trade Monitoring Hook
// ═══════════════════════════════════════════════════════════

/**
 * Monitors all tracked wallets for new trades in the background
 * This runs independently of which wallet is selected
 */
export function useTradeMonitor(wallets: WatchedWallet[], isEnabled: boolean = true) {
    const [lastCheck, setLastCheck] = useState<Date | null>(null);
    const [newTradeCount, setNewTradeCount] = useState(0);
    const isFirstRunRef = useRef(true);

    const checkAllWallets = useCallback(async () => {
        if (!isEnabled || wallets.length === 0) return;

        let totalNewTrades = 0;

        for (const wallet of wallets) {
            try {
                const trades = await fetchTrades(wallet.address);

                // On first run, just initialize tracking without notifications
                const shouldNotify = !isFirstRunRef.current;
                const { newTrades } = detectNewTrades(
                    wallet.address,
                    wallet.label,
                    trades,
                    false // Don't use browser notifications, we'll use toasts
                );

                if (shouldNotify && newTrades.length > 0) {
                    // Emit in-app toasts for new trades
                    for (const trade of newTrades.slice(0, 2)) {
                        emitTradeToast(wallet.label, trade);
                    }
                    totalNewTrades += newTrades.length;
                }
            } catch (error) {
                console.warn(`Failed to check trades for ${wallet.label}:`, error);
            }
        }

        isFirstRunRef.current = false;
        setNewTradeCount(totalNewTrades);
        setLastCheck(new Date());
    }, [wallets, isEnabled]);

    // Initial check and periodic monitoring
    useEffect(() => {
        if (!isEnabled || wallets.length === 0) return;

        // Initial check
        checkAllWallets();

        // Check every 30 seconds
        const interval = setInterval(checkAllWallets, 30_000);

        return () => clearInterval(interval);
    }, [checkAllWallets, isEnabled, wallets.length]);

    return {
        lastCheck,
        newTradeCount,
        checkNow: checkAllWallets,
    };
}
