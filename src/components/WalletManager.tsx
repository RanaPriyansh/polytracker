/**
 * Wallet Manager Component
 * Add/Remove wallet addresses to watch
 */

'use client';

import { useState } from 'react';
import { WatchedWallet } from '@/lib/types';

interface WalletManagerProps {
    wallets: WatchedWallet[];
    onAddWallet: (address: string, label?: string) => Promise<WatchedWallet>;
    onRemoveWallet: (id: string) => void;
    onSelectWallet: (wallet: WatchedWallet) => void;
    selectedWalletId: string | null;
}

export function WalletManager({
    wallets,
    onAddWallet,
    onRemoveWallet,
    onSelectWallet,
    selectedWalletId,
}: WalletManagerProps) {
    const [address, setAddress] = useState('');
    const [label, setLabel] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!address.trim()) {
            setError('Address is required');
            return;
        }

        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            setError('Invalid Ethereum address');
            return;
        }

        setIsAdding(true);
        try {
            const wallet = await onAddWallet(address, label || undefined);
            onSelectWallet(wallet);
            setAddress('');
            setLabel('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add wallet');
        } finally {
            setIsAdding(false);
        }
    };

    const truncateAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return (
        <div className="wallet-manager">
            {/* Add Wallet Form */}
            <form onSubmit={handleSubmit} className="add-wallet-form">
                <div className="input-group">
                    <input
                        type="text"
                        placeholder="0x..."
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="input-address"
                        disabled={isAdding}
                    />
                    <input
                        type="text"
                        placeholder="Label (optional)"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        className="input-label"
                        disabled={isAdding}
                    />
                    <button type="submit" className="btn-add" disabled={isAdding}>
                        {isAdding ? (
                            <span className="loading-spinner" />
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="icon">
                                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                            </svg>
                        )}
                    </button>
                </div>
                {error && <p className="error-message">{error}</p>}
            </form>

            {/* Wallet List */}
            <div className="wallet-list">
                {wallets.length === 0 ? (
                    <p className="empty-state">No wallets added yet. Add a wallet address to start tracking.</p>
                ) : (
                    wallets.map((wallet) => (
                        <div
                            key={wallet.id}
                            className={`wallet-item ${selectedWalletId === wallet.id ? 'selected' : ''}`}
                            onClick={() => onSelectWallet(wallet)}
                        >
                            <div className="wallet-info">
                                <span className="wallet-label">{wallet.label}</span>
                                <span className="wallet-address">{truncateAddress(wallet.address)}</span>
                            </div>
                            <button
                                className="btn-remove"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveWallet(wallet.id);
                                }}
                                title="Remove wallet"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="icon">
                                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
