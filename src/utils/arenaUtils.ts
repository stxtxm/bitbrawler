export type SettingsLogEntry = {
    date: number;
    won: boolean;
    direction: 'outgoing' | 'incoming';
    displayName: string;
};

export const formatSettingsLogDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};
