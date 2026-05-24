import { useState, useMemo } from 'react';
import { Character } from '../types/Character';
import { PixelIcon } from './PixelIcon';
import { SettingsLogEntry, formatSettingsLogDate } from '../utils/arenaUtils';

interface SettingsModalProps {
    isOpen: boolean;
    activeCharacter: Character;
    isOfflineMode: boolean;
    onClose: () => void;
    setAutoMode: (enabled: boolean) => Promise<Character | null>;
    deleteCharacter: () => Promise<boolean>;
    openModal: (message: string) => void;
    ensureConnection: () => Promise<boolean>;
    navigate: (path: string) => void;
}

const SettingsModal = ({
    isOpen,
    activeCharacter,
    isOfflineMode,
    onClose,
    setAutoMode,
    deleteCharacter,
    openModal,
    ensureConnection,
    navigate,
}: SettingsModalProps) => {
    const [settingsView, setSettingsView] = useState<'main' | 'logs'>('main');
    const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm'>('idle');
    const [deletePending, setDeletePending] = useState(false);
    const [localAutoModeUpdating, setLocalAutoModeUpdating] = useState(false);

    const combinedHistory: SettingsLogEntry[] = useMemo(
        () => [
            ...(activeCharacter.fightHistory || []).map((fight) => ({
                date: fight.date,
                won: fight.won,
                direction: 'outgoing' as const,
                displayName: fight.opponentName,
            })),
            ...(activeCharacter.incomingFightHistory || []).map((fight) => ({
                date: fight.date,
                won: fight.won,
                direction: 'incoming' as const,
                displayName: fight.attackerName,
            })),
        ]
            .sort((a, b) => b.date - a.date)
            .slice(0, 20),
        [activeCharacter.fightHistory, activeCharacter.incomingFightHistory]
    );

    const autoModeEnabled = !!activeCharacter?.isBot;

    const handleToggleAutoMode = async () => {
        if (localAutoModeUpdating) return;
        if (isOfflineMode) {
            openModal('Connect to battle and sync your progress.');
            return;
        }
        const canProceed = await ensureConnection();
        if (!canProceed) return;

        setLocalAutoModeUpdating(true);
        try {
            await setAutoMode(!autoModeEnabled);
        } catch (error: any) {
            openModal(error.message || 'Connect to battle and sync your progress.');
        } finally {
            setLocalAutoModeUpdating(false);
        }
    };

    const handleDeleteCharacter = async () => {
        if (deletePending) return;
        if (deleteStep === 'idle') {
            setDeleteStep('confirm');
            return;
        }
        if (isOfflineMode) {
            openModal('Connect to battle and sync your progress.');
            return;
        }
        const canProceed = await ensureConnection();
        if (!canProceed) return;

        setDeletePending(true);
        try {
            await deleteCharacter();
            onClose();
            setTimeout(() => navigate('/'), 0);
        } catch (error: any) {
            openModal(error.message || 'Connect to battle and sync your progress.');
        } finally {
            setDeletePending(false);
        }
    };

    const handleOpenHistoryFromSettings = () => {
        setSettingsView('logs');
    };

    const handleReturnToSettings = () => {
        setSettingsView('main');
    };

    if (!isOpen) return null;

    return (
        <div className="retro-modal-overlay settings-overlay" onClick={onClose}>
            <div className="retro-modal settings-modal" onClick={(e) => e.stopPropagation()}>
                <div className="inventory-header settings-header">
                    <div className="settings-title-row">
                        {settingsView === 'logs' && (
                            <button className="button settings-back" onClick={handleReturnToSettings}>
                                BACK
                            </button>
                        )}
                        <h2 className="inventory-title">{settingsView === 'logs' ? 'COMBAT LOGS' : 'SETTINGS'}</h2>
                    </div>
                    <button className="inventory-close" onClick={onClose} aria-label="Close settings">
                        <PixelIcon type="close" size={14} />
                    </button>
                </div>

                <div className="settings-body">
                    {settingsView === 'logs' ? (
                        <>
                            <div className="history-list settings-history-list">
                                {combinedHistory.length === 0 ? (
                                    <div className="no-history">NO COMBAT ACTIVITY YET</div>
                                ) : (
                                    combinedHistory.map((fight, i) => (
                                        <div key={i} className={`history-item ${fight.won ? 'won' : 'lost'} ${fight.direction}`}>
                                            <div className="history-status">
                                                {fight.direction === 'incoming'
                                                    ? (fight.won ? 'DEFENDED' : 'HIT')
                                                    : (fight.won ? 'WIN' : 'LOST')}
                                            </div>
                                            <div className="history-info">
                                                <div className="history-opponent">
                                                    {fight.direction === 'incoming'
                                                        ? `ATTACKED BY ${fight.displayName}`
                                                        : `VS ${fight.displayName}`}
                                                </div>
                                                <div className="history-date">
                                                    {formatSettingsLogDate(fight.date)}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="inventory-footer">LAST 20 ENCOUNTERS</div>
                        </>
                    ) : (
                        <>
                            <div className="settings-section">
                                <div className="settings-row">
                                    <div className="settings-label">
                                        <span>AUTO MODE</span>
                                        <span className="settings-sub">Let the bot engine handle fights.</span>
                                    </div>
                                    <button
                                        className={`pixel-switch ${autoModeEnabled ? 'on' : 'off'}`}
                                        onClick={handleToggleAutoMode}
                                        disabled={localAutoModeUpdating || isOfflineMode}
                                        role="switch"
                                        aria-checked={autoModeEnabled}
                                        aria-label="Auto mode"
                                    >
                                        <span className="switch-knob" />
                                        <span className="switch-text">{autoModeEnabled ? 'ON' : 'OFF'}</span>
                                    </button>
                                </div>
                                <div className="settings-hint">Switching off returns full manual control.</div>
                            </div>

                            <div className="settings-divider" />

                            <div className="settings-section">
                                <div className="settings-row">
                                    <div className="settings-label">
                                        <span>COMBAT LOGS</span>
                                        <span className="settings-sub">Review your last 20 outgoing and incoming encounters.</span>
                                    </div>
                                    <button className="button settings-link" onClick={handleOpenHistoryFromSettings}>
                                        <PixelIcon type="history" size={14} />
                                        VIEW LOGS
                                    </button>
                                </div>
                            </div>

                            <div className="settings-divider" />

                            <div className="settings-section danger-zone">
                                <div className="settings-row">
                                    <div className="settings-label danger-label">
                                        <span>DELETE CHARACTER</span>
                                        <span className="settings-sub">Permanent. Cannot be undone.</span>
                                    </div>
                                </div>
                                {deleteStep === 'idle' ? (
                                    <button className="button danger-btn" onClick={handleDeleteCharacter}>
                                        DELETE
                                    </button>
                                ) : (
                                    <div className="danger-actions">
                                        <button className="button danger-btn" onClick={handleDeleteCharacter} disabled={deletePending}>
                                            {deletePending ? 'DELETING...' : 'CONFIRM DELETE'}
                                        </button>
                                        <button className="button secondary" onClick={() => setDeleteStep('idle')} disabled={deletePending}>
                                            CANCEL
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
