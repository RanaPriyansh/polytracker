/**
 * Aggregate Trade Feed Component
 * Shows all recent trades from ALL followed wallets in one feed
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Trade, WatchedWallet } from '@/lib/types';
import { fetchTrades } from '@/lib/polymarket';
import {
    detectNewTrades,
    emitTradeToast,
    playNotificationSound,
    isSoundEnabled,
    setSoundEnabled,
    AggregateTradeWithWallet
} from '@/lib/notifications';

interface AggregateFeedProps {
    wallets: WatchedWallet[];
    isEnabled: boolean;
}

interface MarketStats {
    marketTitle: string;
    marketSlug: string;
    tradeCount: number;
    totalVolume: number;
    wallets: string[];
}

const formatTime = (timestamp: string, now: Date) => {
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
};

const formatUSD = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
};

export function AggregateFeed({ wallets, isEnabled }: AggregateFeedProps) {
    const [allTrades, setAllTrades] = useState<AggregateTradeWithWallet[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [soundOn, setSoundOn] = useState(true);
    const [newTradeIds, setNewTradeIds] = useState<Set<string>>(new Set());

    // Initialize sound preference
    useEffect(() => {
        setSoundOn(isSoundEnabled());
    }, []);

    // Fetch trades from all wallets
    const fetchAllTrades = async (checkForNew: boolean = false) => {
        if (!isEnabled || wallets.length === 0) return;

        setIsLoading(true);
        const aggregatedTrades: AggregateTradeWithWallet[] = [];
        const newIds: string[] = [];

        for (const wallet of wallets) {
            try {
                const trades = await fetchTrades(wallet.address);

                // Detect new trades if checking
                if (checkForNew) {
                    const { newTrades } = detectNewTrades(
                        wallet.address,
                        wallet.label,
                        trades,
                        false
                    );

                    if (newTrades.length > 0) {
                        for (const trade of newTrades.slice(0, 3)) {
                            emitTradeToast(wallet.label, trade, soundOn);
                            newIds.push(trade.id);
                        }
                    }
                } else {
                    // Initialize tracking on first load
                    detectNewTrades(wallet.address, wallet.label, trades, false);
                }

                // Add wallet label to each trade
                for (const trade of trades) {
                    aggregatedTrades.push({
                        ...trade,
                        walletLabel: wallet.label,
                    });
                }
            } catch (error) {
                console.warn(`Failed to fetch trades for ${wallet.label}:`, error);
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
    };

    // Initial fetch and periodic refresh
    useEffect(() => {
        if (!isEnabled || wallets.length === 0) return;

        // Initial fetch (don't check for new trades)
        fetchAllTrades(false);

        // Refresh every 30 seconds (check for new trades)
        const interval = setInterval(() => fetchAllTrades(true), 30000);

        return () => clearInterval(interval);
    }, [isEnabled, wallets.length, soundOn]);

    // Calculate market statistics
    const marketStats = useMemo(() => {
        const statsMap = new Map<string, MarketStats>();

        for (const trade of allTrades) {
            const existing = statsMap.get(trade.marketSlug);
            if (existing) {
                existing.tradeCount++;
                existing.totalVolume += trade.usdcAmount;
                if (!existing.wallets.includes(trade.walletLabel)) {
                    existing.wallets.push(trade.walletLabel);
                }
            } else {
                statsMap.set(trade.marketSlug, {
                    marketTitle: trade.marketTitle,
                    marketSlug: trade.marketSlug,
                    tradeCount: 1,
                    totalVolume: trade.usdcAmount,
                    wallets: [trade.walletLabel],
                });
            }
        }

        return Array.from(statsMap.values())
            .sort((a, b) => b.tradeCount - a.tradeCount)
            .slice(0, 8);
    }, [allTrades]);

    const toggleSound = () => {
        const newValue = !soundOn;
        setSoundOn(newValue);
        setSoundEnabled(newValue);
        if (newValue) {
            playNotificationSound(); // Test the sound
        }
    };

    if (!isEnabled || wallets.length === 0) {
        return (
            <div className="aggregate-feed-empty">
                <div className="empty-icon">📊</div>
                <h3>Add wallets to see the trade feed</h3>
                <p>Add trader wallets in the sidebar to start tracking their activity.</p>
            </div>
        );
    }

    // Optimization: Capture current time once per render
    const now = new Date();

    return (
        <div className="aggregate-feed">
            {/* Header with controls */}
            <div className="feed-header">
                <div className="feed-title">
                    <h2>🐋 Whale Activity Feed</h2>
                    <span className="wallet-count">
                        Tracking {wallets.length} wallet{wallets.length !== 1 ? 's' : ''}
                    </span>
                </div>
                <div className="feed-controls">
                    <button
                        className={`btn-sound ${soundOn ? 'active' : ''}`}
                        onClick={toggleSound}
                        title={soundOn ? 'Sound on' : 'Sound off'}
                    >
                        {soundOn ? '🔔' : '🔕'}
                    </button>
                    <button
                        className="btn-refresh-feed"
                        onClick={() => fetchAllTrades(true)}
                        disabled={isLoading}
                    >
                        {isLoading ? '⏳' : '🔄'} Refresh
                    </button>
                    {lastRefresh && (
                        <span className="last-refresh">
                            Updated {formatTime(lastRefresh.toISOString(), now)}
                        </span>
                    )}
                </div>
            </div>

            {/* Market Stats Dashboard */}
            <div className="market-stats-section">
                <h3 className="section-title">📈 Hot Markets</h3>
                <div className="market-stats-grid">
                    {marketStats.map((stat) => (
                        <div key={stat.marketSlug} className="market-stat-card">
                            <div className="market-stat-title" title={stat.marketTitle}>
                                {stat.marketTitle.length > 50
                                    ? stat.marketTitle.slice(0, 50) + '...'
                                    : stat.marketTitle}
                            </div>
                            <div className="market-stat-details">
                                <span className="trade-count">{stat.tradeCount} trades</span>
                                <span className="volume">{formatUSD(stat.totalVolume)}</span>
                            </div>
                            <div className="market-stat-wallets">
                                {stat.wallets.slice(0, 3).map(w => (
                                    <span key={w} className="wallet-tag">{w}</span>
                                ))}
                                {stat.wallets.length > 3 && (
                                    <span className="wallet-tag more">+{stat.wallets.length - 3}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Live Trade Feed */}
            <div className="live-feed-section">
                <h3 className="section-title">
                    ⚡ Live Trades
                    {allTrades.length > 0 && (
                        <span className="trade-count-badge">{allTrades.length}</span>
                    )}
                </h3>

                {isLoading && allTrades.length === 0 ? (
                    <div className="feed-loading">
                        <div className="loading-spinner large" />
                        <p>Loading trades...</p>
                    </div>
                ) : allTrades.length === 0 ? (
                    <div className="feed-empty">
                        <p>No trades found for tracked wallets.</p>
                    </div>
                ) : (
                    <div className="trade-feed-list">
                        {allTrades.slice(0, 50).map((trade, index) => {
                            // Generate a unique key using multiple fields to handle undefined trade.id
                            const uniqueKey = trade.id
                                ? `${trade.walletLabel}-${trade.id}`
                                : `${trade.walletLabel}-${trade.timestamp}-${trade.txHash || index}`;
                            const isNew = trade.id ? newTradeIds.has(trade.id) : false;

                            return (
                                <div
                                    key={uniqueKey}
                                    className={`trade-feed-item ${isNew ? 'new-trade' : ''}`}
                                >
                                    <div className="trade-wallet">
                                        <span className="wallet-label">{trade.walletLabel}</span>
                                        <span className={`side-indicator ${trade.side.toLowerCase()}`}>
                                            {trade.side === 'BUY' ? '🟢' : '🔴'}
                                        </span>
                                    </div>
                                    <div className="trade-market">
                                        <span className="market-title" title={trade.marketTitle}>
                                            {trade.marketTitle.length > 60
                                                ? trade.marketTitle.slice(0, 60) + '...'
                                                : trade.marketTitle}
                                        </span>
                                    </div>
                                    <div className="trade-details">
                                        <span className={`outcome-badge ${trade.outcome.toLowerCase()}`}>
                                            {trade.outcome}
                                        </span>
                                        <span className="trade-price">
                                            @ {(trade.price * 100).toFixed(0)}¢
                                        </span>
                                        <span className="trade-size">
                                            {trade.size.toLocaleString()} shares
                                        </span>
                                        <span className="trade-value">
                                            {formatUSD(trade.usdcAmount)}
                                        </span>
                                    </div>
                                    <div className="trade-time">
                                        <a
                                            href={`https://polygonscan.com/tx/${trade.txHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {formatTime(trade.timestamp, now)}
                                        </a>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
