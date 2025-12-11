/**
 * Toast Notifications Manager
 * Handles toast display and sound effects
 */

'use client';

import { useState, useEffect } from 'react';
import { subscribeToToasts, Toast, removeToast, getNotificationPermission, setNotificationPermission as setPerm } from '@/lib/notifications';

export function ToastContainer() {
    const [toasts, setToasts] = useState<Toast[]>([]);
    // Lazy initialization for permission
    const [permission, setPermission] = useState<NotificationPermission>(() => {
        if (typeof window !== 'undefined') {
            return getNotificationPermission();
        }
        return 'default';
    });

    useEffect(() => {
        // Subscribe to new toasts
        const unsubscribe = subscribeToToasts((toast) => {
            setToasts((prev) => [toast, ...prev].slice(0, 5)); // Keep max 5

            // Auto dismiss after 5 seconds
            setTimeout(() => {
                removeToast(toast.id);
                setToasts((prev) => prev.filter((t) => t.id !== toast.id));
            }, 5000);
        });

        return () => unsubscribe();
    }, []);

    const requestPermission = async () => {
        const result = await setPerm();
        setPermission(result);
    };

    if (toasts.length === 0 && permission === 'granted') {
        return null;
    }

    return (
        <div className="toast-container">
            {permission === 'default' && (
                <div className="permission-banner">
                    <span>Enable desktop notifications for trade alerts?</span>
                    <button onClick={requestPermission}>Enable</button>
                    <button onClick={() => setPermission('denied')}>Dismiss</button>
                </div>
            )}

            {toasts.map((toast) => (
                <div key={toast.id} className={`toast toast-${toast.type} animate-slide-in`}>
                    <div className="toast-content">
                        <h4>{toast.title}</h4>
                        <p>{toast.message}</p>
                        <span className="toast-time">Just now</span>
                    </div>
                    <button
                        className="toast-close"
                        onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}
