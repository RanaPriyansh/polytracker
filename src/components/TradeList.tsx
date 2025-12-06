/**
 * Trade List Component
 * Shows recent trade history
 */

'use client';

import { Trade } from '@/lib/types';

interface TradeListProps {
    trades: Trade[];
    isLoading?: boolean;
}

export function TradeList({ trades, isLoading }: TradeListProps) {
    const formatUSD = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
        }).format(value);
    };

    const formatPrice = (value: number) => {
        return `${(value * 100).toFixed(1)}¢`;
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const truncateHash = (hash: string) => {
        return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
    };

    if (isLoading) {
        return (
            <div className="trade-list">
                <div className="loading-skeleton">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="skeleton-row" />
                    ))}
                </div>
            </div>
        );
    }

    if (trades.length === 0) {
        return (
            <div className="trade-list empty">
                <p>No recent trades</p>
            </div>
        );
    }

    return (
        <div className="trade-list">
            <table>
                <thead>
                    <tr>
                        <th>Market</th>
                        <th>Side</th>
                        <th>Outcome</th>
                        <th>Size</th>
                        <th>Price</th>
                        <th>Value</th>
                        <th>Time</th>
                    </tr>
                </thead>
                <tbody>
                    {trades.map((trade) => (
                        <tr key={trade.id}>
                            <td className="market-title" title={trade.marketTitle}>
                                {trade.marketTitle.length > 40
                                    ? `${trade.marketTitle.slice(0, 40)}...`
                                    : trade.marketTitle}
                            </td>
                            <td>
                                <span className={`side-badge ${trade.side.toLowerCase()}`}>
                                    {trade.side}
                                </span>
                            </td>
                            <td>
                                <span className={`outcome-badge ${trade.outcome.toLowerCase()}`}>
                                    {trade.outcome}
                                </span>
                            </td>
                            <td>{trade.size.toFixed(2)}</td>
                            <td>{formatPrice(trade.price)}</td>
                            <td>{formatUSD(trade.usdcAmount)}</td>
                            <td className="time-cell">
                                <a
                                    href={`https://polygonscan.com/tx/${trade.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={trade.txHash}
                                >
                                    {formatTime(trade.timestamp)}
                                </a>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
