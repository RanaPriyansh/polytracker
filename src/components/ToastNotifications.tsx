/**
 * Toast Notification Component
 * Shows in-app notifications for new trades
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    ToastNotification,
    subscribeToToasts,
    requestNotificationPermission,
    getNotificationPermission
} from '@/lib/notifications';

export function ToastContainer() {
    const [toasts, setToasts] = useState<ToastNotification[]>([]);
    const [notificationPermission, setNotificationPermission] = useState<string>('default');

    useEffect(() => {
        // Get initial notification permission
        setNotificationPermission(getNotificationPermission());

        // Subscribe to new toasts
        const unsubscribe = subscribeToToasts((toast) => {
            setToasts(prev => [...prev, toast]);

            // Auto-remove after 8 seconds
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== toast.id));
            }, 8000);
        });

        return unsubscribe;
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const handleEnableNotifications = async () => {
        const granted = await requestNotificationPermission();
        setNotificationPermission(granted ? 'granted' : 'denied');
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    return (
        <div className="toast-container">
            {/* Notification permission banner */}
            {notificationPermission === 'default' && (
                <div className="notification-banner">
                    <span>🔔 Enable notifications to get alerts when tracked wallets make trades</span>
                    <button onClick={handleEnableNotifications} className="btn-enable">
                        Enable
                    </button>
                </div>
            )}

            {/* Toast notifications */}
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`toast toast-${toast.type}`}
                    onClick={() => {
                        if (toast.trade?.txHash) {
                            window.open(`https://polygonscan.com/tx/${toast.trade.txHash}`, '_blank', 'noopener,noreferrer');
                        }
                        removeToast(toast.id);
                    }}
                >
                    <div className="toast-header">
                        <span className="toast-title">{toast.title}</span>
                        <span className="toast-time">{formatTime(toast.timestamp)}</span>
                    </div>
                    <p className="toast-message">{toast.message}</p>
                    {toast.trade && (
                        <div className="toast-details">
                            <span className="trade-size">
                                {toast.trade.size.toLocaleString()} shares
                            </span>
                            <span className="trade-value">
                                ${toast.trade.usdcAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                    )}
                    <button
                        className="toast-close"
                        onClick={(e) => {
                            e.stopPropagation();
                            removeToast(toast.id);
                        }}
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}
