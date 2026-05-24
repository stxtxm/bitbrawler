import { PixelIcon } from './PixelIcon';

interface FightButtonProps {
    canFight: boolean;
    matchmaking: boolean;
    hasPendingFight: boolean;
    isOfflineMode: boolean;
    fightsLeft: number;
    handleFight: () => void;
}

const FightButton = ({
    canFight,
    matchmaking,
    hasPendingFight,
    isOfflineMode,
    fightsLeft,
    handleFight,
}: FightButtonProps) => {
    const buttonLabel = matchmaking
        ? 'SEARCHING...'
        : hasPendingFight
            ? 'RESOLVING...'
            : (isOfflineMode ? 'OFFLINE' : (fightsLeft > 0 ? 'FIGHT!' : 'REST NOW'));

    return (
        <div className="action-panel">
            <div className="daily-status-compact">
                <div className="status-label">
                    <PixelIcon type="sword" size={32} />
                    <div className="label-text">
                        <span className="label-main">BATTLE ENERGY</span>
                        <span className="label-sub">
                            {isOfflineMode ? 'OFFLINE SNAPSHOT' : `${fightsLeft} / 5 AVAILABLE`}
                        </span>
                    </div>
                </div>
                <div className="mini-pips">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={`mini-pip ${i < fightsLeft ? 'active' : 'used'}`}></div>
                    ))}
                </div>
            </div>

            <button
                className="button primary-btn giant-btn"
                disabled={!canFight || matchmaking}
                onClick={handleFight}
            >
                {buttonLabel}
            </button>
        </div>
    );
};

export default FightButton;
