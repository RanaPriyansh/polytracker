/**
 * Position Card Component
 * Displays a single position with P&L info
 */

'use client';

import { Position } from '@/lib/types';

interface PositionCardProps {
    position: Position;
}

export function PositionCard({ position }: PositionCardProps) {
    const isProfitable = position.unrealizedPnL >= 0;

    const formatUSD = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    const formatPercent = (value: number) => {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}%`;
    };

    const formatPrice = (value: number) => {
        return `${(value * 100).toFixed(1)}¢`;
    };

    return (
        <div className="position-card">
            <div className="position-header">
                <span className={`outcome-badge ${position.outcome.toLowerCase()}`}>
                    {position.outcome}
                </span>
                <span className="position-size">{position.size.toFixed(2)} shares</span>
            </div>

            <h3 className="position-title">{position.marketTitle}</h3>

            <div className="position-details">
                <div className="detail-row">
                    <span className="detail-label">Entry Price</span>
                    <span className="detail-value">{formatPrice(position.avgEntryPrice)}</span>
                </div>
                <div className="detail-row">
                    <span className="detail-label">Current Price</span>
                    <span className="detail-value">{formatPrice(position.currentPrice)}</span>
                </div>
                <div className="detail-row">
                    <span className="detail-label">Value</span>
                    <span className="detail-value">{formatUSD(position.currentValue)}</span>
                </div>
            </div>

            <div className={`position-pnl ${isProfitable ? 'profit' : 'loss'}`}>
                <span className="pnl-value">{formatUSD(position.unrealizedPnL)}</span>
                <span className="pnl-percent">{formatPercent(position.unrealizedPnLPercent)}</span>
            </div>
        </div>
    );
}
