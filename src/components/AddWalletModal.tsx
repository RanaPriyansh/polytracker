/**
 * Add Wallet Modal
 * Modal dialog for adding new traders with tier selection
 */

'use client';

import { useState } from 'react';
import { Tier } from '@/lib/types';

interface AddWalletModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (address: string, label: string, tier: Tier, notes?: string) => Promise<void>;
}

export function AddWalletModal({ isOpen, onClose, onAdd }: AddWalletModalProps) {
    const [address, setAddress] = useState('');
    const [label, setLabel] = useState('');
    const [tier, setTier] = useState<Tier>('watchlist');
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validate address
        if (!address.trim()) {
            setError('Wallet address is required');
            return;
        }

        if (!/^0x[a-fA-F0-9]{40}$/.test(address.trim())) {
            setError('Invalid Ethereum address format');
            return;
        }

        setIsLoading(true);
        try {
            await onAdd(address.trim(), label.trim() || undefined!, tier, notes.trim() || undefined);
            // Reset form
            setAddress('');
            setLabel('');
            setTier('watchlist');
            setNotes('');
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add wallet');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            setError(null);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Add Trader</h2>
                    <button
                        className="modal-close"
                        onClick={handleClose}
                        disabled={isLoading}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Wallet Address */}
                        <div className="form-group">
                            <label htmlFor="address">Wallet Address *</label>
                            <input
                                id="address"
                                type="text"
                                className="input-address"
                                placeholder="0x..."
                                value={address}
                                onChange={e => setAddress(e.target.value)}
                                disabled={isLoading}
                                autoFocus
                            />
                        </div>

                        {/* Label */}
                        <div className="form-group">
                            <label htmlFor="label">Display Name</label>
                            <input
                                id="label"
                                type="text"
                                placeholder="e.g., Whale Alpha, Smart Trader"
                                value={label}
                                onChange={e => setLabel(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>

                        {/* Tier Selection */}
                        <div className="form-group">
                            <label id="tier-label">Tracking Tier</label>
                            <div
                                className="tier-selector"
                                role="radiogroup"
                                aria-labelledby="tier-label"
                            >
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={tier === 'following'}
                                    className={`tier-option ${tier === 'following' ? 'active following' : ''}`}
                                    onClick={() => setTier('following')}
                                    disabled={isLoading}
                                >
                                    <span className="tier-icon">⭐</span>
                                    <div className="tier-info">
                                        <span className="tier-name">Following</span>
                                        <span className="tier-desc">Inner Circle • Instant alerts</span>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={tier === 'watchlist'}
                                    className={`tier-option ${tier === 'watchlist' ? 'active watchlist' : ''}`}
                                    onClick={() => setTier('watchlist')}
                                    disabled={isLoading}
                                >
                                    <span className="tier-icon">👀</span>
                                    <div className="tier-info">
                                        <span className="tier-name">Watchlist</span>
                                        <span className="tier-desc">Radar • Scouting mode</span>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Notes (optional) */}
                        <div className="form-group">
                            <label htmlFor="notes">Notes (optional)</label>
                            <textarea
                                id="notes"
                                placeholder="Why are you tracking this trader?"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                disabled={isLoading}
                                rows={2}
                            />
                        </div>

                        {error && (
                            <div className="form-error">
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="modal-footer">
                        <button
                            type="button"
                            className="btn-cancel"
                            onClick={handleClose}
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={isLoading || !address.trim()}
                        >
                            {isLoading ? (
                                <>
                                    <span className="loading-spinner" />
                                    Adding...
                                </>
                            ) : (
                                <>Add Trader</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
