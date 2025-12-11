/**
 * Utility Functions
 * Shared formatters and helpers used across components
 */

import Decimal from 'decimal.js';

// ═══════════════════════════════════════════════════════════
// Formatting Utilities
// ═══════════════════════════════════════════════════════════

/**
 * Format USD values with K/M suffixes
 */
export function formatUSD(value: number): string {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
}

/**
 * Format relative time (e.g., "5m ago", "2h ago")
 */
export function formatRelativeTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

/**
 * Truncate Ethereum address for display
 */
export function truncateAddress(addr: string): string {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ═══════════════════════════════════════════════════════════
// Math Utilities (Decimal.js for precision)
// ═══════════════════════════════════════════════════════════

/**
 * Safe sum of numbers using Decimal.js
 */
export function safeSum(values: number[]): number {
    return values.reduce(
        (acc, val) => acc.plus(val),
        new Decimal(0)
    ).toNumber();
}

/**
 * Format percentage with sign
 */
export function formatPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
}

/**
 * Format percentage for win rates
 */
export function formatWinRate(value: number): string {
    return `${value.toFixed(0)}%`;
}

// ═══════════════════════════════════════════════════════════
// Validation Utilities
// ═══════════════════════════════════════════════════════════

/**
 * Check if a value is a valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Generate a unique key for trades (handles undefined IDs)
 */
export function getTradeKey(trade: { id?: string; timestamp: string; usdcAmount: number }, index: number): string {
    return trade.id || `${trade.timestamp}-${trade.usdcAmount}-${index}`;
}
