/**
 * Aggregate Trade Feed Component
 * Shows all recent trades from ALL followed wallets in one feed
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { WatchedWallet } from '@/lib/types';
import {
    playNotificationSound,
    isSoundEnabled,
    setSoundEnabled
} from '@/lib/notifications';
import { useAggregateFeed } from '@/hooks/useAggregateFeed';

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

export function AggregateFeed({ wallets, isEnabled }: AggregateFeedProps) {
    // Lazy init for sound preference
    const [soundOn, setSoundOn] = useState(() => {
        if (typeof window !== 'undefined') {
            return isSoundEnabled();
        }
        return false;
    });

    // Use the optimized hook
    const { allTrades, isLoading, lastRefresh, newTradeIds, refresh } = useAggregateFeed(wallets, isEnabled);

    // Handle sound effects when new trades appear
    useEffect(() => {
        if (newTradeIds.size > 0 && soundOn) {
            playNotificationSound();
        }
    }, [newTradeIds, soundOn]);

    const handleRefresh = async () => {
        const newIds = await refresh();
        if (newIds && newIds.length > 0 && soundOn) {
             playNotificationSound();
        }
    };

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

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
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

    if (!isEnabled || wallets.length === 0) {
        return (
            <div className="aggregate-feed-empty">
                <div className="empty-icon">📊</div>
                <h3>Add wallets to see the trade feed</h3>
                <p>Add trader wallets in the sidebar to start tracking their activity.</p>
            </div>
        );
    }

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
                        onClick={handleRefresh}
                        disabled={isLoading}
                    >
                        {isLoading ? '⏳' : '🔄'} Refresh
                    </button>
                    {lastRefresh && (
                        <span className="last-refresh">
                            Updated {formatTime(lastRefresh.toISOString())}
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
                                            {formatTime(trade.timestamp)}
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
