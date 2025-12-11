/**
 * Ghost Portfolio Panel Component
 * Displays simulated copy-trading P&L for a wallet with ghost mode enabled
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import { WatchedWallet, Trade } from '@/lib/types';
import { buildGhostPortfolio, GhostPortfolioSummary } from '@/lib/ghostPortfolio';
import { fetchTrades } from '@/lib/polymarket';
import { formatUSD, formatRelativeTime } from '@/lib/utils';
import Decimal from 'decimal.js';

interface GhostPortfolioPanelProps {
    wallet: WatchedWallet;
    onClose: () => void;
}

export function GhostPortfolioPanel({ wallet, onClose }: GhostPortfolioPanelProps) {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch trades on mount
    useEffect(() => {
        async function loadTrades() {
            try {
                setIsLoading(true);
                const walletTrades = await fetchTrades(wallet.address);
                setTrades(walletTrades);
                setError(null);
            } catch (err) {
                setError('Failed to load trades');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }
        loadTrades();
    }, [wallet.address]);

    // Build ghost portfolio from trades
    const ghostPortfolio = useMemo(() => {
        return buildGhostPortfolio(wallet, trades);
    }, [wallet, trades]);

    // Calculate P&L percentage
    const pnlPercent = useMemo(() => {
        if (ghostPortfolio.totalInvested === 0) return 0;
        return new Decimal(ghostPortfolio.totalPnL)
            .div(ghostPortfolio.totalInvested)
            .times(100)
            .toNumber();
    }, [ghostPortfolio]);

    // Format date for display
    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    if (!wallet.ghostMode) {
        return (
            <div className="ghost-panel ghost-panel-disabled">
                <div className="ghost-panel-header">
                    <h3>👻 Ghost Mode</h3>
                    <button className="btn-close" onClick={onClose}>×</button>
                </div>
                <div className="ghost-panel-empty">
                    <p>Ghost mode is not enabled for this wallet.</p>
                    <p className="ghost-hint">Enable ghost mode to simulate copy-trading.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="ghost-panel">
            <div className="ghost-panel-header">
                <div className="ghost-title">
                    <span className="ghost-icon">👻</span>
                    <h3>Ghost Portfolio</h3>
                </div>
                <button className="btn-close" onClick={onClose}>×</button>
            </div>

            <div className="ghost-meta">
                <div className="meta-item">
                    <span className="meta-label">Wallet</span>
                    <span className="meta-value">{wallet.label}</span>
                </div>
                <div className="meta-item">
                    <span className="meta-label">Started</span>
                    <span className="meta-value">{formatDate(ghostPortfolio.ghostStartedAt)}</span>
                </div>
                <div className="meta-item">
                    <span className="meta-label">Trades</span>
                    <span className="meta-value">{ghostPortfolio.tradeCount}</span>
                </div>
            </div>

            {isLoading ? (
                <div className="ghost-loading">
                    <div className="loading-spinner" />
                    <span>Loading trades...</span>
                </div>
            ) : error ? (
                <div className="ghost-error">
                    <p>{error}</p>
                </div>
            ) : (
                <>
                    <div className="ghost-pnl-card">
                        <h4>Simulated Performance</h4>

                        <div className="pnl-grid">
                            <div className="pnl-row">
                                <span className="pnl-label">Invested</span>
                                <span className="pnl-value">{formatUSD(ghostPortfolio.totalInvested)}</span>
                            </div>
                            <div className="pnl-row">
                                <span className="pnl-label">Returns</span>
                                <span className="pnl-value">{formatUSD(ghostPortfolio.totalReturns)}</span>
                            </div>
                            <div className="pnl-row">
                                <span className="pnl-label">Realized P&L</span>
                                <span className={`pnl-value ${ghostPortfolio.realizedPnL >= 0 ? 'positive' : 'negative'}`}>
                                    {ghostPortfolio.realizedPnL >= 0 ? '+' : ''}{formatUSD(ghostPortfolio.realizedPnL)}
                                </span>
                            </div>
                            <div className="pnl-row">
                                <span className="pnl-label">Unrealized P&L</span>
                                <span className={`pnl-value ${ghostPortfolio.unrealizedPnL >= 0 ? 'positive' : 'negative'}`}>
                                    {ghostPortfolio.unrealizedPnL >= 0 ? '+' : ''}{formatUSD(ghostPortfolio.unrealizedPnL)}
                                </span>
                            </div>
                            <div className="pnl-divider" />
                            <div className="pnl-row pnl-total">
                                <span className="pnl-label">Total P&L</span>
                                <span className={`pnl-value ${ghostPortfolio.totalPnL >= 0 ? 'positive' : 'negative'}`}>
                                    {ghostPortfolio.totalPnL >= 0 ? '+' : ''}{formatUSD(ghostPortfolio.totalPnL)}
                                    <span className="pnl-percent">
                                        ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%)
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {ghostPortfolio.positions.length > 0 && (
                        <div className="ghost-positions">
                            <h4>Open Positions ({ghostPortfolio.positions.filter(p => p.shares > 0).length})</h4>

                            <div className="positions-list">
                                {ghostPortfolio.positions
                                    .filter(p => p.shares > 0)
                                    .map((pos, idx) => (
                                        <div key={idx} className="ghost-position-card">
                                            <div className="position-market">
                                                {pos.marketTitle.length > 50
                                                    ? pos.marketTitle.slice(0, 50) + '...'
                                                    : pos.marketTitle}
                                            </div>
                                            <div className="position-details">
                                                <span className={`outcome-badge outcome-${pos.outcome.toLowerCase()}`}>
                                                    {pos.outcome}
                                                </span>
                                                <span className="position-shares">
                                                    {pos.shares.toFixed(2)} shares @ {(pos.avgEntryPrice * 100).toFixed(0)}¢
                                                </span>
                                                <span className={`position-pnl ${pos.unrealizedPnL >= 0 ? 'positive' : 'negative'}`}>
                                                    {pos.unrealizedPnL >= 0 ? '+' : ''}{formatUSD(pos.unrealizedPnL)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
