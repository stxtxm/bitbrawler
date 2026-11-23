export type SettingsLogEntry = {
    date: number;
    won: boolean;
    direction: 'outgoing' | 'incoming';
    displayName: string;
    xpGained?: number;
    essenceGained?: number;
};

export const formatSettingsLogDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

/**
 * Compact timestamp for the in-arena PvP feed. The full date stays available
 * through the row's `title` attribute, so mobile rows do not waste a line on
 * a locale-formatted date they cannot read at 0.4rem.
 */
export const formatRelativeLogDate = (timestamp: number, now: number = Date.now()) => {
    if (!Number.isFinite(timestamp) || timestamp <= 0) return 'UNKNOWN';

    const diffMs = Math.max(0, now - timestamp);
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return 'JUST NOW';
    if (minutes < 60) return `${minutes}M AGO`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}H AGO`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}D AGO`;

    return new Date(timestamp).toLocaleDateString();
};
