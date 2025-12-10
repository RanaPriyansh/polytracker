/**
 * Wallet Manager Component v2.0
 * Tiered sidebar with Following (gold) and Watchlist (grey) sections
 */

'use client';

import { useState, useMemo } from 'react';
import { WatchedWallet, Tier } from '@/lib/types';
import { AddWalletModal } from './AddWalletModal';

interface WalletManagerProps {
    wallets: WatchedWallet[];
    onAddWallet: (address: string, label?: string, tier?: Tier, notes?: string) => Promise<WatchedWallet>;
    onRemoveWallet: (id: string) => void;
    onSelectWallet: (wallet: WatchedWallet) => void;
    onUpdateWallet: (id: string, updates: Partial<WatchedWallet>) => void;
    selectedWalletId: string | null;
}

export function WalletManager({
    wallets,
    onAddWallet,
    onRemoveWallet,
    onSelectWallet,
    onUpdateWallet,
    selectedWalletId,
}: WalletManagerProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [followingCollapsed, setFollowingCollapsed] = useState(false);
    const [watchlistCollapsed, setWatchlistCollapsed] = useState(false);

    // Split wallets by tier
    const { following, watchlist } = useMemo(() => ({
        following: wallets.filter(w => w.tier === 'following'),
        watchlist: wallets.filter(w => w.tier === 'watchlist'),
    }), [wallets]);

    const truncateAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const handlePromote = (id: string, newTier: Tier) => {
        onUpdateWallet(id, { tier: newTier });
    };

    const handleAddWallet = async (address: string, label: string, tier: Tier, notes?: string) => {
        const wallet = await onAddWallet(address, label, tier, notes);
        onSelectWallet(wallet);
    };

    const renderWalletItem = (wallet: WatchedWallet) => (
        <div
            key={wallet.id}
            className={`wallet-item tier-${wallet.tier} ${selectedWalletId === wallet.id ? 'selected' : ''}`}
            onClick={() => onSelectWallet(wallet)}
        >
            <div className="wallet-item-main">
                <span className="wallet-tier-icon">
                    {wallet.tier === 'following' ? '⭐' : '👀'}
                </span>
                <div className="wallet-info">
                    <span className="wallet-label">{wallet.label}</span>
                    <span className="wallet-address">{truncateAddress(wallet.address)}</span>
                </div>
            </div>

            {/* Stats preview for Following tier */}
            {wallet.tier === 'following' && wallet.stats && (
                <div className="wallet-stats-mini">
                    <span className={`win-rate ${wallet.stats.winRate >= 50 ? 'positive' : 'negative'}`}>
                        {wallet.stats.winRate.toFixed(0)}%
                    </span>
                </div>
            )}

            <div className="wallet-actions">
                {/* Tier toggle */}
                <button
                    className="btn-tier-toggle"
                    onClick={(e) => {
                        e.stopPropagation();
                        handlePromote(wallet.id, wallet.tier === 'following' ? 'watchlist' : 'following');
                    }}
                    title={wallet.tier === 'following' ? 'Move to Watchlist' : 'Promote to Following'}
                >
                    {wallet.tier === 'following' ? '👀' : '⭐'}
                </button>

                {/* Remove button */}
                <button
                    className="btn-remove"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemoveWallet(wallet.id);
                    }}
                    title="Remove trader"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="icon">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
    );

    return (
        <div className="wallet-manager">
            {/* Following Section (Inner Circle) */}
            <div className="tier-section following-section">
                <button
                    className="tier-header"
                    onClick={() => setFollowingCollapsed(!followingCollapsed)}
                >
                    <span className="tier-title">
                        <span className="tier-icon">⭐</span>
                        Following
                        <span className="tier-count">{following.length}</span>
                    </span>
                    <span className={`collapse-icon ${followingCollapsed ? 'collapsed' : ''}`}>
                        ▼
                    </span>
                </button>

                {!followingCollapsed && (
                    <div className="tier-list">
                        {following.length === 0 ? (
                            <p className="tier-empty">
                                No traders in your inner circle yet.
                                <br />
                                <span className="tier-empty-hint">Promote from Watchlist or add new.</span>
                            </p>
                        ) : (
                            following.map(renderWalletItem)
                        )}
                    </div>
                )}
            </div>

            {/* Watchlist Section (Radar) */}
            <div className="tier-section watchlist-section">
                <button
                    className="tier-header"
                    onClick={() => setWatchlistCollapsed(!watchlistCollapsed)}
                >
                    <span className="tier-title">
                        <span className="tier-icon">👀</span>
                        Watchlist
                        <span className="tier-count">{watchlist.length}</span>
                    </span>
                    <span className={`collapse-icon ${watchlistCollapsed ? 'collapsed' : ''}`}>
                        ▼
                    </span>
                </button>

                {!watchlistCollapsed && (
                    <div className="tier-list">
                        {watchlist.length === 0 ? (
                            <p className="tier-empty">
                                No traders on your radar.
                                <br />
                                <span className="tier-empty-hint">Add traders to scout potential alpha.</span>
                            </p>
                        ) : (
                            watchlist.map(renderWalletItem)
                        )}
                    </div>
                )}
            </div>

            {/* Floating Add Button */}
            <button
                className="btn-add-floating"
                onClick={() => setIsModalOpen(true)}
                title="Add Trader"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="icon">
                    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
            </button>

            {/* Add Wallet Modal */}
            <AddWalletModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAdd={handleAddWallet}
            />
        </div>
    );
}

