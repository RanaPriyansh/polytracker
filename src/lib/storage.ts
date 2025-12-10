/**
 * localStorage wrapper for wallet storage
 * V2: Supports Tier system (Following/Watchlist)
 */

import { WatchedWallet, Tier, TraderStats } from './types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'polytracker_wallets';
const STATS_CACHE_KEY = 'polytracker_trader_stats';
const STORAGE_VERSION = 2; // Increment when schema changes

function isBrowser(): boolean {
    return typeof window !== 'undefined';
}

/**
 * Migrate wallets from v1 to v2 (add tier field)
 */
function migrateWallets(wallets: WatchedWallet[]): WatchedWallet[] {
    return wallets.map(wallet => ({
        ...wallet,
        // Default existing wallets to 'watchlist' - user can promote to 'following'
        tier: wallet.tier || 'watchlist',
    }));
}

export const walletStorage = {
    getAll(): WatchedWallet[] {
        if (!isBrowser()) return [];
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            const wallets: WatchedWallet[] = data ? JSON.parse(data) : [];
            // Auto-migrate on read
            const migrated = migrateWallets(wallets);
            // Save if migration changed anything
            if (JSON.stringify(wallets) !== JSON.stringify(migrated)) {
                this.save(migrated);
            }
            return migrated;
        } catch {
            return [];
        }
    },

    /**
     * Get wallets filtered by tier
     */
    getByTier(tier: Tier): WatchedWallet[] {
        return this.getAll().filter(w => w.tier === tier);
    },

    /**
     * Get Following wallets (inner circle)
     */
    getFollowing(): WatchedWallet[] {
        return this.getByTier('following');
    },

    /**
     * Get Watchlist wallets (radar/scouting)
     */
    getWatchlist(): WatchedWallet[] {
        return this.getByTier('watchlist');
    },

    save(wallets: WatchedWallet[]): void {
        if (!isBrowser()) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
    },

    add(address: string, label?: string, tier: Tier = 'watchlist', notes?: string): WatchedWallet {
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
            label: label || `Trader ${wallets.length + 1}`,
            tier,
            notes,
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
        // Also remove cached stats
        this.removeStats(id);
    },

    update(id: string, updates: Partial<WatchedWallet>): void {
        const wallets = this.getAll().map(w =>
            w.id === id ? { ...w, ...updates } : w
        );
        this.save(wallets);
    },

    /**
     * Promote wallet to Following tier
     */
    promoteTo(id: string, tier: Tier): void {
        this.update(id, { tier });
    },

    /**
     * Toggle ghost mode for paper trading
     */
    toggleGhostMode(id: string, enabled: boolean): void {
        this.update(id, {
            ghostMode: enabled,
            ghostStartedAt: enabled ? new Date().toISOString() : undefined,
        });
    },

    updateProxyAddress(id: string, proxyAddress: string): void {
        this.update(id, { proxyAddress });
    },

    updateLastSynced(id: string): void {
        this.update(id, { lastSyncedAt: new Date().toISOString() });
    },

    // ═══════════════════════════════════════════════════════════
    // Trader Stats Caching
    // ═══════════════════════════════════════════════════════════

    getAllStats(): Record<string, TraderStats> {
        if (!isBrowser()) return {};
        try {
            const data = localStorage.getItem(STATS_CACHE_KEY);
            return data ? JSON.parse(data) : {};
        } catch {
            return {};
        }
    },

    getStats(walletId: string): TraderStats | null {
        const allStats = this.getAllStats();
        return allStats[walletId] || null;
    },

    saveStats(walletId: string, stats: TraderStats): void {
        if (!isBrowser()) return;
        const allStats = this.getAllStats();
        allStats[walletId] = stats;
        localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(allStats));
    },

    removeStats(walletId: string): void {
        if (!isBrowser()) return;
        const allStats = this.getAllStats();
        delete allStats[walletId];
        localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(allStats));
    },

    /**
     * Check if stats are stale (older than 6 hours)
     */
    isStatsStale(walletId: string): boolean {
        const stats = this.getStats(walletId);
        if (!stats) return true;
        const sixHoursAgo = Date.now() - (6 * 60 * 60 * 1000);
        return stats.lastUpdated < sixHoursAgo;
    },
};

