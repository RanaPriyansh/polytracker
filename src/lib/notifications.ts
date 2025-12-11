/**
 * Trade Notification System
 * Monitors tracked wallets for new trades and sends browser notifications
 */

import { Trade } from './types';

// ═══════════════════════════════════════════════════════════
// Storage for last seen trades
// ═══════════════════════════════════════════════════════════

const LAST_SEEN_KEY = 'polytracker_last_seen_trades';
const SOUND_ENABLED_KEY = 'polytracker_sound_enabled';

interface LastSeenTrades {
    [walletAddress: string]: {
        lastTradeId: string;
        lastTradeTimestamp: string;
    };
}

function getLastSeenTrades(): LastSeenTrades {
    if (typeof window === 'undefined') return {};
    try {
        const data = localStorage.getItem(LAST_SEEN_KEY);
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
}

function setLastSeenTrades(data: LastSeenTrades): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(data));
}

function updateLastSeenForWallet(walletAddress: string, trade: Trade): void {
    const lastSeen = getLastSeenTrades();
    lastSeen[walletAddress.toLowerCase()] = {
        lastTradeId: trade.id,
        lastTradeTimestamp: trade.timestamp,
    };
    setLastSeenTrades(lastSeen);
}

// ═══════════════════════════════════════════════════════════
// Notification Sound System
// ═══════════════════════════════════════════════════════════

let notificationAudio: HTMLAudioElement | null = null;

export function initNotificationSound(): void {
    if (typeof window === 'undefined') return;
    if (notificationAudio) return;

    // Create audio element with a pleasant notification sound
    // Using a data URL for a simple beep sound
    notificationAudio = new Audio();
    notificationAudio.volume = 0.5;

    // Use a base64 encoded short notification sound
    // This is a simple pleasant "ding" sound
    notificationAudio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1qW11jbX57foOChoiGhYN+eXFnXlVRUVVdZ3F+h4uNj42LiIN7cGVbUU1MW2BpcoSLj5GTk5CLhHtwZVpRTE1UVHT';
}

export function isSoundEnabled(): boolean {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(SOUND_ENABLED_KEY);
    return stored !== 'false';
}

export function setSoundEnabled(enabled: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SOUND_ENABLED_KEY, enabled ? 'true' : 'false');
}

export function playNotificationSound(): void {
    if (typeof window === 'undefined') return;
    if (!isSoundEnabled()) return;

    // Use Web Audio API for a more reliable notification sound
    try {
        const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();

        // Create a pleasant two-tone notification
        const playTone = (freq: number, startTime: number, duration: number) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(freq, startTime);

            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
            gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

            oscillator.start(startTime);
            oscillator.stop(startTime + duration);
        };

        const now = audioContext.currentTime;
        playTone(880, now, 0.1);      // A5
        playTone(1108, now + 0.1, 0.15); // C#6

    } catch (error) {
        console.warn('Could not play notification sound:', error);
    }
}

// ═══════════════════════════════════════════════════════════
// Notification Permission
// ═══════════════════════════════════════════════════════════

export async function requestNotificationPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        console.warn('Notifications not supported in this browser');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission === 'denied') {
        console.warn('Notification permission denied');
        return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return 'unsupported';
    }
    return Notification.permission;
}

// ═══════════════════════════════════════════════════════════
// Send Notification
// ═══════════════════════════════════════════════════════════

interface TradeNotificationData {
    walletLabel: string;
    trade: Trade;
}

function sendTradeNotification({ walletLabel, trade }: TradeNotificationData): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const sideEmoji = trade.side === 'BUY' ? '🟢' : '🔴';
    const title = `${sideEmoji} ${walletLabel} - ${trade.side}`;

    const usdAmount = trade.usdcAmount.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });

    const pricePercent = (trade.price * 100).toFixed(0);

    const body = [
        `${trade.marketTitle}`,
        `${trade.outcome} @ ${pricePercent}¢`,
        `${trade.size.toLocaleString()} shares (${usdAmount})`,
    ].join('\n');

    const notification = new Notification(title, {
        body,
        icon: '/whale-icon.png',
        tag: trade.id,
        requireInteraction: false,
    });

    setTimeout(() => notification.close(), 10000);

    notification.onclick = () => {
        window.open(`https://polygonscan.com/tx/${trade.txHash}`, '_blank', 'noopener,noreferrer');
        notification.close();
    };
}

// ═══════════════════════════════════════════════════════════
// Detect New Trades
// ═══════════════════════════════════════════════════════════

export interface NewTradeResult {
    newTrades: Trade[];
    hasNewTrades: boolean;
}

export function detectNewTrades(
    walletAddress: string,
    walletLabel: string,
    trades: Trade[],
    sendNotifications: boolean = true
): NewTradeResult {
    if (trades.length === 0) {
        return { newTrades: [], hasNewTrades: false };
    }

    const lastSeen = getLastSeenTrades();
    const lastSeenForWallet = lastSeen[walletAddress.toLowerCase()];

    const sortedTrades = [...trades].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const latestTrade = sortedTrades[0];

    if (!lastSeenForWallet) {
        updateLastSeenForWallet(walletAddress, latestTrade);
        return { newTrades: [], hasNewTrades: false };
    }

    const lastSeenTime = new Date(lastSeenForWallet.lastTradeTimestamp).getTime();
    const newTrades = sortedTrades.filter(
        trade => new Date(trade.timestamp).getTime() > lastSeenTime
    );

    if (newTrades.length > 0) {
        updateLastSeenForWallet(walletAddress, latestTrade);

        if (sendNotifications) {
            const tradesToNotify = newTrades.slice(0, 5);
            for (const trade of tradesToNotify) {
                sendTradeNotification({ walletLabel, trade });
            }
        }
    }

    return {
        newTrades,
        hasNewTrades: newTrades.length > 0,
    };
}

// ═══════════════════════════════════════════════════════════
// In-App Toast Notification
// ═══════════════════════════════════════════════════════════

export interface ToastNotification {
    id: string;
    type: 'trade' | 'info' | 'error';
    title: string;
    message: string;
    trade?: Trade;
    walletLabel?: string;
    timestamp: Date;
}

type ToastListener = (toast: ToastNotification) => void;
const toastListeners: Set<ToastListener> = new Set();

export function subscribeToToasts(listener: ToastListener): () => void {
    toastListeners.add(listener);
    return () => toastListeners.delete(listener);
}

export function emitToast(toast: Omit<ToastNotification, 'id' | 'timestamp'>): void {
    const fullToast: ToastNotification = {
        ...toast,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
    };

    toastListeners.forEach(listener => listener(fullToast));
}

export function emitTradeToast(walletLabel: string, trade: Trade, playSound: boolean = true): void {
    const sideEmoji = trade.side === 'BUY' ? '🟢' : '🔴';
    emitToast({
        type: 'trade',
        title: `${sideEmoji} ${walletLabel} ${trade.side}`,
        message: `${trade.marketTitle} - ${trade.outcome} @ ${(trade.price * 100).toFixed(0)}¢`,
        trade,
        walletLabel,
    });

    // Play notification sound
    if (playSound) {
        playNotificationSound();
    }
}

// ═══════════════════════════════════════════════════════════
// Aggregate Trade Feed Events
// ═══════════════════════════════════════════════════════════

export interface AggregateTradeWithWallet extends Trade {
    walletLabel: string;
}

type AggregateTradeListener = (trades: AggregateTradeWithWallet[]) => void;
const aggregateTradeListeners: Set<AggregateTradeListener> = new Set();

export function subscribeToAggregateTrades(listener: AggregateTradeListener): () => void {
    aggregateTradeListeners.add(listener);
    return () => aggregateTradeListeners.delete(listener);
}

export function emitAggregateTrades(trades: AggregateTradeWithWallet[]): void {
    aggregateTradeListeners.forEach(listener => listener(trades));
}
