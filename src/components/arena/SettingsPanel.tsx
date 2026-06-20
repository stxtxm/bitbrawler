import { memo } from 'react';
import { PixelIcon } from '../PixelIcon';
import { SettingsLogEntry, formatSettingsLogDate } from '../../utils/arenaUtils';

interface SettingsPanelProps {
  settingsView: 'main' | 'logs';
  autoModeEnabled: boolean;
  autoModeUpdating: boolean;
  soundEnabled: boolean;
  deleteStep: 'idle' | 'confirm';
  deletePending: boolean;
  combinedHistory: SettingsLogEntry[];
  isOfflineMode: boolean;
  onClose: () => void;
  onToggleAutoMode: () => void;
  onToggleSound: () => void;
  onDeleteCharacter: () => void;
  onOpenLogs: () => void;
  onReturnToMain: () => void;
  onSetDeleteStep: (step: 'idle' | 'confirm') => void;
}

export const SettingsPanel = memo(function SettingsPanel({
  settingsView, autoModeEnabled, autoModeUpdating, soundEnabled,
  deleteStep, deletePending, combinedHistory, isOfflineMode,
  onClose, onToggleAutoMode, onToggleSound, onDeleteCharacter,
  onOpenLogs, onReturnToMain, onSetDeleteStep,
}: SettingsPanelProps) {
  return (
    <div className="retro-modal-overlay settings-overlay" onClick={onClose}>
      <div className="retro-modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="inventory-header settings-header">
          <div className="settings-title-row">
            {settingsView === 'logs' && (
              <button className="button settings-back" onClick={onReturnToMain}>BACK</button>
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
                        <div className="history-date">{formatSettingsLogDate(fight.date)}</div>
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
                    onClick={onToggleAutoMode}
                    disabled={autoModeUpdating || isOfflineMode}
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
                    <span>SOUND</span>
                    <span className="settings-sub">Toggle game audio effects.</span>
                  </div>
                  <button
                    className={`pixel-switch ${soundEnabled ? 'on' : 'off'}`}
                    onClick={onToggleSound}
                    role="switch"
                    aria-checked={soundEnabled}
                    aria-label="Sound"
                  >
                    <span className="switch-knob" />
                    <span className="switch-text">{soundEnabled ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
              </div>

              <div className="settings-divider" />

              <div className="settings-section">
                <div className="settings-row">
                  <div className="settings-label">
                    <span>COMBAT LOGS</span>
                    <span className="settings-sub">Review your last 20 outgoing and incoming encounters.</span>
                  </div>
                  <button className="button settings-link" onClick={onOpenLogs}>
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
                  <button className="button danger-btn" onClick={onDeleteCharacter}>DELETE</button>
                ) : (
                  <div className="danger-actions">
                    <button className="button danger-btn" onClick={onDeleteCharacter} disabled={deletePending}>
                      {deletePending ? 'DELETING...' : 'CONFIRM DELETE'}
                    </button>
                    <button className="button secondary" onClick={() => onSetDeleteStep('idle')} disabled={deletePending}>
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
});
