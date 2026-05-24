import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { useConnectionGate } from '../hooks/useConnectionGate';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import ConnectionModal from '../components/ConnectionModal';
import { PixelIcon } from '../components/PixelIcon';
import { getXpProgress, getMaxLevel } from '../utils/xpUtils';
import { StatKey } from '../utils/statUtils';
import { CombatView } from '../components/CombatView';
import { MatchmakingResult } from '../utils/matchmakingUtils';
import { applyEquipmentToCharacter } from '../utils/equipmentUtils';
import LevelUpOverlay from '../components/LevelUpOverlay';
import CharacterStats from '../components/CharacterStats';
import FightButton from '../components/FightButton';
import InventoryModal from '../components/InventoryModal';
import SettingsModal from '../components/SettingsModal';

type StatIconType = 'strength' | 'vitality' | 'dexterity' | 'luck' | 'intelligence' | 'focus';

const Arena = () => {
    const { activeCharacter, logout, useFight, startMatchmaking, lastXpGain, lastLevelUp, clearXpNotifications, dbAvailable, allocateStatPoint, rollLootbox, setAutoMode, deleteCharacter } = useGame();
    const { ensureConnection, openModal, closeModal, connectionModal } = useConnectionGate();
    const navigate = useNavigate();
    const isOnline = useOnlineStatus();
    const connectionMessage = 'Connect to battle and sync your progress.';

    const [showXpGain, setShowXpGain] = useState(false);
    const [showLevelUp, setShowLevelUp] = useState(false);
    const [xpBarAnimating, setXpBarAnimating] = useState(false);
    const [inventoryOpen, setInventoryOpen] = useState(false);
    const [matchmaking, setMatchmaking] = useState(false);
    const [combatData, setCombatData] = useState<MatchmakingResult | null>(null);
    const [allocatingStat, setAllocatingStat] = useState<StatKey | null>(null);
    const [deferLevelUp, setDeferLevelUp] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Handle XP gain notification
    useEffect(() => {
        if (lastXpGain !== null) {
            setShowXpGain(true);
            setXpBarAnimating(true);

            const timer = setTimeout(() => {
                setShowXpGain(false);
                setXpBarAnimating(false);
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [lastXpGain]);

    // Handle Level up notification
    useEffect(() => {
        if (lastLevelUp !== null) {
            setShowLevelUp(true);
            setDeferLevelUp(false);
        }
    }, [lastLevelUp]);

    if (!activeCharacter) {
        setTimeout(() => navigate('/'), 100);
        return <div className="loading-screen">ACCESS DENIED</div>;
    }

    const effectiveCharacter = applyEquipmentToCharacter(activeCharacter);
    const xpProgress = getXpProgress(activeCharacter);
    const isMaxLevel = activeCharacter.level >= getMaxLevel();
    const isOfflineMode = !isOnline || !dbAvailable;
    const fightsLeft = activeCharacter.fightsLeft || 0;
    const hasPendingFight = !!activeCharacter.pendingFight;
    const canFight = !isOfflineMode && fightsLeft > 0 && !hasPendingFight;
    const pendingStatPoints = activeCharacter.statPoints || 0;
    const canCloseLevelUp = pendingStatPoints === 0;
    const shouldShowLevelUp = showLevelUp || (pendingStatPoints > 0 && !deferLevelUp);
    const hasLevelInfo = lastLevelUp !== null;

    const statOptions: Array<{ key: StatKey; label: string; value: number; hint: string; icon: StatIconType }> = [
        { key: 'strength', label: 'STR', value: effectiveCharacter.strength, hint: 'Damage', icon: 'strength' },
        { key: 'vitality', label: 'VIT', value: effectiveCharacter.vitality, hint: 'HP / Defense', icon: 'vitality' },
        { key: 'dexterity', label: 'DEX', value: effectiveCharacter.dexterity, hint: 'Speed', icon: 'dexterity' },
        { key: 'luck', label: 'LUK', value: effectiveCharacter.luck, hint: 'Crit Chance', icon: 'luck' },
        { key: 'intelligence', label: 'INT', value: effectiveCharacter.intelligence, hint: 'Magic Power', icon: 'intelligence' },
        { key: 'focus', label: 'FOC', value: effectiveCharacter.focus, hint: 'Accuracy / Control', icon: 'focus' },
    ];

    const handleAllocateStat = async (stat: StatKey) => {
        if (allocatingStat || pendingStatPoints <= 0) return;
        if (isOfflineMode) { openModal(connectionMessage); return; }
        setAllocatingStat(stat);
        try { await allocateStatPoint(stat); }
        catch (error: any) { openModal(error.message || connectionMessage); }
        finally { setAllocatingStat(null); }
    };

    const handleCloseLevelUp = () => {
        if (!canCloseLevelUp) return;
        setShowLevelUp(false);
        clearXpNotifications();
    };

    const handleDeferLevelUp = () => {
        setShowLevelUp(false);
        setDeferLevelUp(true);
        clearXpNotifications();
    };

    const handleOpenLevelUp = () => {
        setShowLevelUp(true);
        setDeferLevelUp(false);
    };

    useEffect(() => {
        if (pendingStatPoints === 0) setDeferLevelUp(false);
    }, [pendingStatPoints]);

    const handleFight = async () => {
        if (matchmaking || hasPendingFight) return;
        const canProceed = await ensureConnection(connectionMessage);
        if (!canProceed) return;

        if (window.navigator.vibrate) window.navigator.vibrate(80);
        setMatchmaking(true);

        try {
            const match = await startMatchmaking();
            if (!match) {
                openModal('No opponents found! Try again later.');
                setMatchmaking(false);
                return;
            }
            setCombatData(match);
            setMatchmaking(false);
        } catch (error) {
            console.error('Matchmaking failed:', error);
            openModal(connectionMessage);
            setMatchmaking(false);
        }
    };

    const handleCombatComplete = async (won: boolean, xpGained: number) => {
        try {
            const opponentName = combatData?.opponent.name || 'UNKNOWN';
            const opponentId = combatData?.opponent.id || '';
            await useFight(won, xpGained, opponentName, opponentId);
        } catch (error: any) {
            console.error('Fight result save failed:', error);
            openModal(error.message || connectionMessage);
        }
    };

    const handleCloseCombat = () => setCombatData(null);

    return (
        <div className="container retro-container arena-container">
            <LevelUpOverlay
                shouldShowLevelUp={shouldShowLevelUp}
                activeCharacter={activeCharacter}
                effectiveCharacter={effectiveCharacter}
                lastLevelUp={lastLevelUp}
                pendingStatPoints={pendingStatPoints}
                isOfflineMode={isOfflineMode}
                allocatingStat={allocatingStat}
                statOptions={statOptions}
                canCloseLevelUp={canCloseLevelUp}
                hasLevelInfo={hasLevelInfo}
                handleAllocateStat={handleAllocateStat}
                handleCloseLevelUp={handleCloseLevelUp}
                handleDeferLevelUp={handleDeferLevelUp}
            />

            <header className="arena-header">
                <div className="char-info">
                    <h2 className="arena-char-name">{activeCharacter.name}</h2>
                    <div className="arena-lvl">
                        <span className="lvl-label">LVL</span>
                        <span className="lvl-chip">{activeCharacter.level}</span>
                    </div>
                </div>
                <div className="header-actions">
                    <button className="button icon-btn" onClick={() => setSettingsOpen(true)} title="Settings" aria-label="Settings">
                        <PixelIcon type="gear" size={26} />
                    </button>
                    <button className="button icon-btn inventory-btn" onClick={() => setInventoryOpen(true)} title="Inventory" aria-label="Inventory">
                        <PixelIcon type="backpack" size={26} />
                    </button>
                    <button className="button icon-btn" onClick={() => { logout(); setTimeout(() => navigate('/'), 0); }} title="Logout">
                        <PixelIcon type="power" size={26} />
                    </button>
                </div>
            </header>

            {isOfflineMode && (
                <div className="offline-banner" role="status" aria-live="polite">
                    <div className="offline-row">
                        <div className="offline-title">OFFLINE MODE</div>
                    </div>
                    <div className="offline-sub">Stats are the last synced snapshot. Connect to fight and sync.</div>
                </div>
            )}

            <div className="arena-content">
                <CharacterStats
                    activeCharacter={activeCharacter}
                    effectiveCharacter={effectiveCharacter}
                    xpProgress={xpProgress}
                    xpBarAnimating={xpBarAnimating}
                    showXpGain={showXpGain}
                    lastXpGain={lastXpGain}
                    isMaxLevel={isMaxLevel}
                    pendingStatPoints={pendingStatPoints}
                    statOptions={statOptions}
                    handleOpenLevelUp={handleOpenLevelUp}
                />
                <FightButton
                    canFight={canFight}
                    matchmaking={matchmaking}
                    hasPendingFight={hasPendingFight}
                    isOfflineMode={isOfflineMode}
                    fightsLeft={fightsLeft}
                    handleFight={handleFight}
                />
            </div>

            <ConnectionModal
                open={connectionModal.open}
                message={connectionModal.message}
                onClose={closeModal}
            />
            <InventoryModal
                isOpen={inventoryOpen}
                activeCharacter={activeCharacter}
                isOfflineMode={isOfflineMode}
                onClose={() => setInventoryOpen(false)}
                rollLootbox={rollLootbox}
                openModal={openModal}
            />
            <SettingsModal
                isOpen={settingsOpen}
                activeCharacter={activeCharacter}
                isOfflineMode={isOfflineMode}
                onClose={() => setSettingsOpen(false)}
                setAutoMode={setAutoMode}
                deleteCharacter={deleteCharacter}
                openModal={openModal}
                ensureConnection={() => ensureConnection(connectionMessage)}
                navigate={navigate}
            />
            {combatData && activeCharacter && (
                <CombatView
                    player={applyEquipmentToCharacter(activeCharacter)}
                    opponent={applyEquipmentToCharacter(combatData.opponent)}
                    matchType={combatData.matchType}
                    candidates={combatData.candidates}
                    onComplete={handleCombatComplete}
                    onClose={handleCloseCombat}
                />
            )}
        </div>
    );
};

export default Arena;
