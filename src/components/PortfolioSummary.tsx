/**
 * Portfolio Summary Component
 * Shows total value and P&L
 */

'use client';

interface PortfolioSummaryProps {
    totalValue: number;
    totalPnL: number;
    totalPnLPercent: number;
    positionCount: number;
    isLoading?: boolean;
}

export function PortfolioSummary({
    totalValue,
    totalPnL,
    totalPnLPercent,
    positionCount,
    isLoading,
}: PortfolioSummaryProps) {
    const isProfitable = totalPnL >= 0;

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

    if (isLoading) {
        return (
            <div className="portfolio-summary loading">
                <div className="summary-card skeleton" />
                <div className="summary-card skeleton" />
                <div className="summary-card skeleton" />
            </div>
        );
    }

    return (
        <div className="portfolio-summary">
            <div className="summary-card">
                <span className="summary-label">Portfolio Value</span>
                <span className="summary-value primary">{formatUSD(totalValue)}</span>
            </div>

            <div className="summary-card">
                <span className="summary-label">Unrealized P&L</span>
                <span className={`summary-value ${isProfitable ? 'profit' : 'loss'}`}>
                    {formatUSD(totalPnL)}
                </span>
            </div>

            <div className="summary-card">
                <span className="summary-label">Return</span>
                <span className={`summary-value ${isProfitable ? 'profit' : 'loss'}`}>
                    {formatPercent(totalPnLPercent)}
                </span>
            </div>

            <div className="summary-card">
                <span className="summary-label">Positions</span>
                <span className="summary-value">{positionCount}</span>
            </div>
        </div>
    );
}
