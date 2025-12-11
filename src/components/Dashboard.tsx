/**
 * Dashboard Component
 * Main application view with aggregate feed and individual wallet views
 */

'use client';

import { useState } from 'react';
import { WalletManager } from './WalletManager';
import { PositionCard } from './PositionCard';
import { TradeList } from './TradeList';
import { PortfolioSummary } from './PortfolioSummary';
import { ToastContainer } from './ToastNotifications';
import { AggregateFeed } from './AggregateFeed';
import { ContextPanel } from './ContextPanel';
import { ErrorBoundary } from './ErrorBoundary';
import { useWallets, usePortfolio } from '@/hooks/usePolymarket';
import { WatchedWallet, Tier } from '@/lib/types';

type ViewMode = 'feed' | 'wallet';

export function Dashboard() {
    const { wallets, isLoaded, addWallet, removeWallet, updateWallet } = useWallets();
    const [selectedWallet, setSelectedWallet] = useState<WatchedWallet | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('feed');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Pass wallet label for notifications
    const portfolio = usePortfolio(
        viewMode === 'wallet' ? selectedWallet?.address ?? null : null,
        selectedWallet?.label
    );

    const handleSelectWallet = (wallet: WatchedWallet) => {
        setSelectedWallet(wallet);
        setViewMode('wallet');
    };

    const handleBackToFeed = () => {
        setViewMode('feed');
        setSelectedWallet(null);
    };

    const handleRemoveWallet = (id: string) => {
        if (selectedWallet?.id === id) {
            setSelectedWallet(null);
            setViewMode('feed');
        }
        removeWallet(id);
    };

    const handleAddWallet = async (address: string, label?: string, tier?: Tier, notes?: string) => {
        return addWallet(address, label, tier, notes);
    };

    if (!isLoaded) {
        return (
            <div className="dashboard loading-state">
                <div className="loading-spinner large" />
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <div className="dashboard three-zone">
                {/* Zone 1: Navigation Sidebar */}
                <aside className="sidebar">
                    <div className="sidebar-header">
                        <div className="header-top">
                            <h1 className="logo" onClick={handleBackToFeed} style={{ cursor: 'pointer' }}>
                                <span className="logo-icon">🐋</span>
                                PolyTracker
                            </h1>
                            <button
                                className="btn-add-header"
                                onClick={() => setIsAddModalOpen(true)}
                                title="Add Trader"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="icon">
                                    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                                </svg>
                            </button>
                        </div>
                        <p className="tagline">Intelligence Platform</p>
                    </div>

                    {/* View Mode Toggle */}
                    <div className="view-toggle">
                        <button
                            className={`toggle-btn ${viewMode === 'feed' ? 'active' : ''}`}
                            onClick={handleBackToFeed}
                        >
                            📊 Feed
                        </button>
                        <button
                            className={`toggle-btn ${viewMode === 'wallet' ? 'active' : ''}`}
                            onClick={() => selectedWallet && setViewMode('wallet')}
                            disabled={!selectedWallet}
                        >
                            👛 Wallet
                        </button>
                    </div>

                    <WalletManager
                        wallets={wallets}
                        onAddWallet={handleAddWallet}
                        onRemoveWallet={handleRemoveWallet}
                        onSelectWallet={handleSelectWallet}
                        onUpdateWallet={updateWallet}
                        selectedWalletId={selectedWallet?.id ?? null}
                        isAddModalOpen={isAddModalOpen}
                        onCloseAddModal={() => setIsAddModalOpen(false)}
                    />

                    <div className="sidebar-footer">
                        <p className="refresh-info">
                            🔔 Auto-refresh: 30s
                        </p>
                    </div>
                </aside>

                {/* Toast Notifications */}
                <ToastContainer />

                {/* Main Content */}
                <main className="main-content">
                    {viewMode === 'feed' ? (
                        /* Aggregate Feed View */
                        <AggregateFeed wallets={wallets} isEnabled={isLoaded} />
                    ) : selectedWallet ? (
                        /* Individual Wallet View */
                        <>
                            <header className="content-header">
                                <div className="wallet-display">
                                    <button className="btn-back" onClick={handleBackToFeed}>
                                        ← Back to Feed
                                    </button>
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
                    ) : (
                        <div className="empty-dashboard">
                            <div className="empty-icon">🎯</div>
                            <h2>Select a wallet to view details</h2>
                            <p>Click on a wallet in the sidebar to see positions and trades.</p>
                        </div>
                    )}
                </main>

                {/* Zone 3: Context Panel (Right) */}
                <ContextPanel
                    sectorActivity={{
                        Politics: 0,
                        Crypto: 0,
                        Sports: 0,
                        Business: 0,
                        Entertainment: 0,
                        Other: 0,
                    }}
                    recentAlerts={[]}
                    wallets={wallets}
                />
            </div>
        </ErrorBoundary>
    );
}
