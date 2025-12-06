/**
 * localStorage wrapper for wallet storage
 * V1: Client-side only storage
 */

import { WatchedWallet } from './types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'polytracker_wallets';

function isBrowser(): boolean {
    return typeof window !== 'undefined';
}

export const walletStorage = {
    getAll(): WatchedWallet[] {
        if (!isBrowser()) return [];
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    },

    save(wallets: WatchedWallet[]): void {
        if (!isBrowser()) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
    },

    add(address: string, label?: string): WatchedWallet {
        const wallets = this.getAll();

        // Check for duplicate
        const existing = wallets.find(
            w => w.address.toLowerCase() === address.toLowerCase()
        );
        if (existing) {
            throw new Error('Wallet already exists');
        }

        const newWallet: WatchedWallet = {
            id: uuidv4(),
            address: address.toLowerCase(),
            proxyAddress: null,
            label: label || `Wallet ${wallets.length + 1}`,
            addedAt: new Date().toISOString(),
            lastSyncedAt: null,
        };

        wallets.push(newWallet);
        this.save(wallets);
        return newWallet;
    },

    remove(id: string): void {
        const wallets = this.getAll().filter(w => w.id !== id);
        this.save(wallets);
    },

    update(id: string, updates: Partial<WatchedWallet>): void {
        const wallets = this.getAll().map(w =>
            w.id === id ? { ...w, ...updates } : w
        );
        this.save(wallets);
    },

    updateProxyAddress(id: string, proxyAddress: string): void {
        this.update(id, { proxyAddress });
    },

    updateLastSynced(id: string): void {
        this.update(id, { lastSyncedAt: new Date().toISOString() });
    },
};
