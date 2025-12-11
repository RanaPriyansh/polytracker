
import { useState, useEffect, useCallback, useRef } from 'react';
import { Trade, WatchedWallet } from '@/lib/types';
import { fetchTrades } from '@/lib/polymarket';
import { fetchAllWalletsSafe } from '@/hooks/usePolymarket';
import { detectNewTrades, emitTradeToast } from '@/lib/notifications';

export interface AggregateTradeWithWallet extends Trade {
    walletLabel: string;
}

export function useAggregateFeed(wallets: WatchedWallet[], isEnabled: boolean) {
    const [allTrades, setAllTrades] = useState<AggregateTradeWithWallet[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [newTradeIds, setNewTradeIds] = useState<Set<string>>(new Set());
    const isFirstFetchRef = useRef(true);

    const fetchAllTrades = useCallback(async () => {
        if (!isEnabled || wallets.length === 0) return;

        setIsLoading(true);
        const aggregatedTrades: AggregateTradeWithWallet[] = [];
        const newIds: string[] = [];

        // Use safe parallel fetching
        const tradesMap = await fetchAllWalletsSafe(wallets, fetchTrades);

        for (const wallet of wallets) {
            const trades = tradesMap.get(wallet.id);

            if (trades) {
                 // Detect new trades
                 // If not first fetch, we want to emit toasts
                 // If first fetch, we just want to initialize the "last seen" cache
                const shouldNotify = !isFirstFetchRef.current;

                const { newTrades } = detectNewTrades(
                    wallet.address,
                    wallet.label,
                    trades,
                    false // Don't use browser notifications, we'll use toasts
                );

                if (shouldNotify && newTrades.length > 0) {
                    for (const trade of newTrades.slice(0, 3)) {
                         emitTradeToast(wallet.label, trade);
                         newIds.push(trade.id);
                    }
                }

                // Add wallet label to each trade
                for (const trade of trades) {
                    aggregatedTrades.push({
                        ...trade,
                        walletLabel: wallet.label,
                    });
                }
            }
        }

        // Sort by timestamp, newest first
        aggregatedTrades.sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Update new trade IDs for highlighting
        if (newIds.length > 0) {
            setNewTradeIds(prev => new Set([...prev, ...newIds]));
            // Clear highlighting after 5 seconds
            setTimeout(() => {
                setNewTradeIds(prev => {
                    const updated = new Set(prev);
                    newIds.forEach(id => updated.delete(id));
                    return updated;
                });
            }, 5000);
        }

        setAllTrades(aggregatedTrades);
        setLastRefresh(new Date());
        setIsLoading(false);
        isFirstFetchRef.current = false;

        // Return new IDs so the component can play sound if needed
        return newIds;

    }, [wallets, isEnabled]);

    // Initial fetch and periodic refresh
    useEffect(() => {
        if (!isEnabled || wallets.length === 0) return;

        // Initial fetch - wrap in timeout to avoid sync state update lint error
        setTimeout(() => fetchAllTrades(), 0);

        // Refresh every 30 seconds
        const interval = setInterval(() => {
            fetchAllTrades();
        }, 30000);

        return () => clearInterval(interval);
    }, [fetchAllTrades, isEnabled, wallets.length]);

    return {
        allTrades,
        isLoading,
        lastRefresh,
        newTradeIds,
        refresh: fetchAllTrades
    };
}
