/**
 * Dashboard Component
 * Main application view combining all features
 */

'use client';

import { useState } from 'react';
import { WalletManager } from './WalletManager';
import { PositionCard } from './PositionCard';
import { TradeList } from './TradeList';
import { PortfolioSummary } from './PortfolioSummary';
import { useWallets, usePortfolio } from '@/hooks/usePolymarket';
import { WatchedWallet } from '@/lib/types';

export function Dashboard() {
    const { wallets, isLoaded, addWallet, removeWallet } = useWallets();
    const [selectedWallet, setSelectedWallet] = useState<WatchedWallet | null>(null);

    const portfolio = usePortfolio(selectedWallet?.address ?? null);

    const handleSelectWallet = (wallet: WatchedWallet) => {
        setSelectedWallet(wallet);
    };

    const handleRemoveWallet = (id: string) => {
        // Clear selection if removing the currently selected wallet
        if (selectedWallet?.id === id) {
            setSelectedWallet(null);
        }
        removeWallet(id);
    };

    if (!isLoaded) {
        return (
            <div className="dashboard loading-state">
                <div className="loading-spinner large" />
            </div>
        );
    }

    return (
        <div className="dashboard">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h1 className="logo">
                        <span className="logo-icon">🐋</span>
                        PolyTracker
                    </h1>
                    <p className="tagline">Whale Watching for Polymarket</p>
                </div>

                <WalletManager
                    wallets={wallets}
                    onAddWallet={addWallet}
                    onRemoveWallet={handleRemoveWallet}
                    onSelectWallet={handleSelectWallet}
                    selectedWalletId={selectedWallet?.id ?? null}
                />

                <div className="sidebar-footer">
                    <p className="refresh-info">
                        Auto-refresh: 60s
                    </p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                {!selectedWallet ? (
                    <div className="empty-dashboard">
                        <div className="empty-icon">🎯</div>
                        <h2>Select a wallet to view positions</h2>
                        <p>Add wallet addresses in the sidebar to start tracking whale activity on Polymarket.</p>
                    </div>
                ) : (
                    <>
                        <header className="content-header">
                            <div className="wallet-display">
                                <h2>{selectedWallet.label}</h2>
                                <span className="wallet-address">{selectedWallet.address}</span>
                            </div>
                            <button
                                className="btn-refresh"
                                onClick={() => portfolio.refetch()}
                                disabled={portfolio.isLoading}
                            >
                                {portfolio.isLoading ? (
                                    <span className="loading-spinner" />
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="icon">
                                        <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
                                    </svg>
                                )}
                                Refresh
                            </button>
                        </header>

                        {portfolio.isError && (
                            <div className="error-banner">
                                <p>Failed to load data. Retrying...</p>
                            </div>
                        )}

                        <PortfolioSummary
                            totalValue={portfolio.totalValue}
                            totalPnL={portfolio.totalPnL}
                            totalPnLPercent={portfolio.totalPnLPercent}
                            positionCount={portfolio.positions.length}
                            isLoading={portfolio.isLoading}
                        />

                        <section className="section positions-section">
                            <h3 className="section-title">Active Positions</h3>
                            {portfolio.positions.length === 0 ? (
                                <div className="empty-section">
                                    <p>No active positions found for this wallet.</p>
                                </div>
                            ) : (
                                <div className="positions-grid">
                                    {portfolio.positions.map((position) => (
                                        <PositionCard key={position.id} position={position} />
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="section trades-section">
                            <h3 className="section-title">Recent Trades</h3>
                            <TradeList trades={portfolio.trades} isLoading={portfolio.isLoading} />
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}
