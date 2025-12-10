/**
 * Context Panel Component
 * Right zone of three-zone layout showing sectors, alerts, and market watch
 */

'use client';

import { Sector, WatchedWallet, Trade } from '@/lib/types';

interface ContextPanelProps {
    sectorActivity: Record<Sector, number>;
    recentAlerts: Array<{
        id: string;
        type: 'conflict' | 'consensus' | 'high_volume';
        message: string;
        timestamp: string;
    }>;
    wallets: WatchedWallet[];
}

export function ContextPanel({ sectorActivity, recentAlerts, wallets }: ContextPanelProps) {
    const sortedSectors = Object.entries(sectorActivity)
        .filter(([, count]) => count > 0)
        .sort(([, a], [, b]) => b - a);

    const followingCount = wallets.filter(w => w.tier === 'following').length;
    const watchlistCount = wallets.filter(w => w.tier === 'watchlist').length;

    return (
        <aside className="context-panel">
            {/* Sector Heatmap */}
            <div className="context-section">
                <h3 className="context-title">
                    <span className="context-icon">📊</span>
                    Hot Sectors
                </h3>
                <div className="sector-heatmap">
                    {sortedSectors.length > 0 ? (
                        sortedSectors.map(([sector, count]) => (
                            <div
                                key={sector}
                                className={`heatmap-item ${getHeatLevel(count)}`}
                            >
                                <span className="heatmap-label">{sector}</span>
                                <span className="heatmap-count">{count}</span>
                            </div>
                        ))
                    ) : (
                        <p className="context-empty">No activity yet</p>
                    )}
                </div>
            </div>

            {/* Portfolio Summary */}
            <div className="context-section">
                <h3 className="context-title">
                    <span className="context-icon">👁️</span>
                    Tracking
                </h3>
                <div className="tracking-summary">
                    <div className="tracking-item following">
                        <span className="tracking-icon">⭐</span>
                        <span className="tracking-label">Following</span>
                        <span className="tracking-count">{followingCount}</span>
                    </div>
                    <div className="tracking-item watchlist">
                        <span className="tracking-icon">👀</span>
                        <span className="tracking-label">Watchlist</span>
                        <span className="tracking-count">{watchlistCount}</span>
                    </div>
                </div>
            </div>

            {/* Recent Alerts */}
            <div className="context-section">
                <h3 className="context-title">
                    <span className="context-icon">🔔</span>
                    Alerts
                    {recentAlerts.length > 0 && (
                        <span className="alert-badge">{recentAlerts.length}</span>
                    )}
                </h3>
                <div className="alert-list">
                    {recentAlerts.length > 0 ? (
                        recentAlerts.slice(0, 5).map(alert => (
                            <div key={alert.id} className={`alert-item ${alert.type}`}>
                                <span className="alert-icon">
                                    {alert.type === 'conflict' ? '⚠️' :
                                        alert.type === 'consensus' ? '🎯' : '📈'}
                                </span>
                                <span className="alert-message">{alert.message}</span>
                            </div>
                        ))
                    ) : (
                        <p className="context-empty">No alerts</p>
                    )}
                </div>
            </div>
        </aside>
    );
}

function getHeatLevel(count: number): string {
    if (count >= 10) return 'hot';
    if (count >= 5) return 'warm';
    if (count >= 2) return 'mild';
    return 'cool';
}
