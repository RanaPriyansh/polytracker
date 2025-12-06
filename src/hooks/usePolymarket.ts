/**
 * React Query hooks for data fetching
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPositions, fetchTrades, resolveProxy } from '@/lib/polymarket';
import { walletStorage } from '@/lib/storage';
import { WatchedWallet, Position, Trade } from '@/lib/types';
import { useState, useEffect } from 'react';

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
const REFETCH_INTERVAL = 60_000; // 60 seconds

export function usePositions(walletAddress: string | null) {
    return useQuery({
        queryKey: ['positions', walletAddress],
        queryFn: () => fetchPositions(walletAddress!),
        enabled: !!walletAddress,
        staleTime: STALE_TIME,
        refetchInterval: REFETCH_INTERVAL,
        retry: 3,
        retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 30_000),
    });
}

export function useTrades(walletAddress: string | null) {
    return useQuery({
        queryKey: ['trades', walletAddress],
        queryFn: () => fetchTrades(walletAddress!),
        enabled: !!walletAddress,
        staleTime: STALE_TIME,
        refetchInterval: REFETCH_INTERVAL,
        retry: 3,
        retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 30_000),
    });
}

// ═══════════════════════════════════════════════════════════
// Aggregated Portfolio Hook
// ═══════════════════════════════════════════════════════════

export function usePortfolio(walletAddress: string | null) {
    const positions = usePositions(walletAddress);
    const trades = useTrades(walletAddress);

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
