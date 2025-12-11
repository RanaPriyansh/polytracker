/**
 * Fortress Storage Manager v2.1
 * 
 * PATCHES APPLIED:
 * - K-03: Debounced save to prevent race conditions
 * - K-04: Cross-tab synchronization via storage events
 */

import { WatchedWallet, Tier, TraderStats } from './types';
import { v4 as uuidv4 } from 'uuid';
import { debounce } from 'lodash-es';

const STORAGE_KEY = 'polytracker_wallets_v2';
const STATS_CACHE_KEY = 'polytracker_trader_stats';

// ═══════════════════════════════════════════════════════════
// Storage Class with Debouncing & Cross-Tab Sync
// ═══════════════════════════════════════════════════════════

class WalletStorageManager {
    private listeners: Set<(wallets: WatchedWallet[]) => void> = new Set();
    private _cachedWallets: WatchedWallet[] | null = null;

    constructor() {
        // K-04: Cross-Tab Synchronization
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', (e) => {
                if (e.key === STORAGE_KEY) {
                    this._cachedWallets = null; // Invalidate cache
                    this.notifyListeners();
                }
            });
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Core CRUD Operations
    // ═══════════════════════════════════════════════════════════

    private isBrowser(): boolean {
        return typeof window !== 'undefined';
    }

    /**
     * K-03: Debounced save to prevent race conditions during rapid toggles
     */
    private saveToDisk = debounce((data: WatchedWallet[]) => {
        if (!this.isBrowser()) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }, 300);

    /**
     * Immediate save (for critical operations like add/remove)
     */
    private saveImmediate(data: WatchedWallet[]): void {
        if (!this.isBrowser()) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        this._cachedWallets = data;
    }

    getAll(): WatchedWallet[] {
        if (!this.isBrowser()) return [];

        // Use cache if available
        if (this._cachedWallets) return this._cachedWallets;

        try {
            const data = localStorage.getItem(STORAGE_KEY);
            const wallets: WatchedWallet[] = data ? JSON.parse(data) : [];
            const migrated = this.migrateWallets(wallets);

            if (JSON.stringify(wallets) !== JSON.stringify(migrated)) {
                this.saveImmediate(migrated);
            }

            this._cachedWallets = migrated;
            return migrated;
        } catch {
            return [];
        }
    }

    /**
     * Migrate wallets from v1 to v2 (add tier field)
     */
    private migrateWallets(wallets: WatchedWallet[]): WatchedWallet[] {
        return wallets.map(wallet => ({
            ...wallet,
            tier: wallet.tier || 'watchlist',
        }));
    }

    /**
     * Get wallets filtered by tier
     */
    getByTier(tier: Tier): WatchedWallet[] {
        return this.getAll().filter(w => w.tier === tier);
    }

    getFollowing(): WatchedWallet[] {
        return this.getByTier('following');
    }

    getWatchlist(): WatchedWallet[] {
        return this.getByTier('watchlist');
    }

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
        this.saveImmediate(wallets); // Immediate save for add
        this.notifyListeners(wallets);
        return newWallet;
    }

    remove(id: string): void {
        const wallets = this.getAll().filter(w => w.id !== id);
        this.saveImmediate(wallets); // Immediate save for remove
        this.removeStats(id);
        this.notifyListeners(wallets);
    }

    /**
     * K-03: Debounced update for non-critical operations
     */
    update(id: string, updates: Partial<WatchedWallet>): void {
        const wallets = this.getAll().map(w =>
            w.id === id ? { ...w, ...updates } : w
        );
        this._cachedWallets = wallets; // Optimistic UI update
        this.notifyListeners(wallets);
        this.saveToDisk(wallets); // Debounced save
    }

    promoteTo(id: string, tier: Tier): void {
        this.update(id, { tier });
    }

    toggleGhostMode(id: string, enabled: boolean): void {
        this.update(id, {
            ghostMode: enabled,
            ghostStartedAt: enabled ? new Date().toISOString() : undefined,
        });
    }

    updateProxyAddress(id: string, proxyAddress: string): void {
        this.update(id, { proxyAddress });
    }

    updateLastSynced(id: string): void {
        this.update(id, { lastSyncedAt: new Date().toISOString() });
    }

    // ═══════════════════════════════════════════════════════════
    // Subscription System (K-04: Cross-Tab Updates)
    // ═══════════════════════════════════════════════════════════

    subscribe(callback: (wallets: WatchedWallet[]) => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    private notifyListeners(data?: WatchedWallet[]): void {
        const wallets = data || this.getAll();
        this.listeners.forEach(cb => cb(wallets));
    }

    // ═══════════════════════════════════════════════════════════
    // Trader Stats Caching
    // ═══════════════════════════════════════════════════════════

    getAllStats(): Record<string, TraderStats> {
        if (!this.isBrowser()) return {};
        try {
            const data = localStorage.getItem(STATS_CACHE_KEY);
            return data ? JSON.parse(data) : {};
        } catch {
            return {};
        }
    }

    getStats(walletId: string): TraderStats | null {
        const allStats = this.getAllStats();
        return allStats[walletId] || null;
    }

    saveStats(walletId: string, stats: TraderStats): void {
        if (!this.isBrowser()) return;
        const allStats = this.getAllStats();
        allStats[walletId] = stats;
        localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(allStats));
    }

    removeStats(walletId: string): void {
        if (!this.isBrowser()) return;
        const allStats = this.getAllStats();
        delete allStats[walletId];
        localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(allStats));
    }

    isStatsStale(walletId: string): boolean {
        const stats = this.getStats(walletId);
        if (!stats) return true;
        const sixHoursAgo = Date.now() - (6 * 60 * 60 * 1000);
        return stats.lastUpdated < sixHoursAgo;
    }
}

// Export singleton instance
export const walletStorage = new WalletStorageManager();
