/**
 * Sector Filter Component
 * Top ribbon for filtering feed by sector
 */

'use client';

import { Sector } from '@/lib/types';

type FilterOption = 'all' | Sector;

interface SectorFilterProps {
    activeFilter: FilterOption;
    onFilterChange: (filter: FilterOption) => void;
    sectorCounts?: Record<Sector, number>;
}

const SECTORS: { key: FilterOption; label: string; icon: string }[] = [
    { key: 'all', label: 'All', icon: '📊' },
    { key: 'Politics', label: 'Politics', icon: '🏛️' },
    { key: 'Crypto', label: 'Crypto', icon: '🪙' },
    { key: 'Sports', label: 'Sports', icon: '⚽' },
    { key: 'Business', label: 'Business', icon: '💼' },
    { key: 'Entertainment', label: 'Entertainment', icon: '🎬' },
];

export function SectorFilter({ activeFilter, onFilterChange, sectorCounts }: SectorFilterProps) {
    return (
        <div className="sector-filter">
            {SECTORS.map(({ key, label, icon }) => (
                <button
                    key={key}
                    className={`sector-btn ${activeFilter === key ? 'active' : ''}`}
                    onClick={() => onFilterChange(key)}
                >
                    <span className="sector-icon">{icon}</span>
                    <span className="sector-label">{label}</span>
                    {key !== 'all' && sectorCounts && sectorCounts[key as Sector] > 0 && (
                        <span className="sector-count">{sectorCounts[key as Sector]}</span>
                    )}
                </button>
            ))}
        </div>
    );
}
