import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { useConnectionGate } from '../hooks/useConnectionGate';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useFightFlow } from '../hooks/useFightFlow';
import { getXpProgress, getMaxLevel } from '../utils/xpUtils';
import { applyEquipmentToCharacter } from '../utils/equipmentUtils';
import { StatKey } from '../utils/statUtils';
import ConnectionModal from '../components/ConnectionModal';
import LevelUpOverlay from '../components/LevelUpOverlay';
import InventoryModal from '../components/InventoryModal';
import SettingsModal from '../components/SettingsModal';
import CharacterStats from '../components/CharacterStats';
import FightButton from '../components/FightButton';
import { CombatView } from '../components/CombatView';
import { PixelIcon } from '../components/PixelIcon';

type StatIconType = 'strength' | 'vitality' | 'dexterity' | 'luck' | 'intelligence' | 'focus';

const Arena = () => {
    const { activeCharacter, logout, lastXpGain, lastLevelUp, clearXpNotifications, dbAvailable, allocateStatPoint, rollLootbox, setAutoMode, deleteCharacter } = useGame();
    const { ensureConnection, openModal, closeModal, connectionModal } = useConnectionGate();
    const navigate = useNavigate();
    const isOnline = useOnlineStatus();
    const connectionMessage = 'Connect to battle and sync your progress.';

    // ─── XP & Level-up state ────────────────────────────────────────────────
    const [showXpGain, setShowXpGain] = useState(false);
    const [showLevelUp, setShowLevelUp] = useState(false);
    const [xpBarAnimating, setXpBarAnimating] = useState(false);
    const [deferLevelUp, setDeferLevelUp] = useState(false);
    const [allocatingStat, setAllocatingStat] = useState<StatKey | null>(null);

    // ─── Modal toggles ──────────────────────────────────────────────────────
    const [inventoryOpen, setInventoryOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // ─── Derived values ─────────────────────────────────────────────────────
    const isOfflineMode = !isOnline || !dbAvailable;
    const fightsLeft = activeCharacter?.fightsLeft || 0;
    const hasPendingFight = !!activeCharacter?.pendingFight;
    const pendingStatPoints = activeCharacter?.statPoints || 0;
    const canCloseLevelUp = pendingStatPoints === 0;
    const shouldShowLevelUp = showLevelUp || (pendingStatPoints > 0 && !deferLevelUp);
    const hasLevelInfo = lastLevelUp !== null;
    const isMaxLevel = (activeCharacter?.level || 0) >= getMaxLevel();
    const effectiveCharacter = activeCharacter ? applyEquipmentToCharacter(activeCharacter) : null;
    const xpProgress = activeCharacter ? getXpProgress(activeCharacter) : { percentage: 0 };

    const statOptions = useMemo(() => {
        if (!effectiveCharacter) return [];
        return [
            { key: 'strength' as StatKey, label: 'STR', value: effectiveCharacter.strength, hint: 'Damage', icon: 'strength' as StatIconType },
            { key: 'vitality' as StatKey, label: 'VIT', value: effectiveCharacter.vitality, hint: 'HP / Defense', icon: 'vitality' as StatIconType },
            { key: 'dexterity' as StatKey, label: 'DEX', value: effectiveCharacter.dexterity, hint: 'Speed', icon: 'dexterity' as StatIconType },
            { key: 'luck' as StatKey, label: 'LUK', value: effectiveCharacter.luck, hint: 'Crit Chance', icon: 'luck' as StatIconType },
            { key: 'intelligence' as StatKey, label: 'INT', value: effectiveCharacter.intelligence, hint: 'Magic Power', icon: 'intelligence' as StatIconType },
            { key: 'focus' as StatKey, label: 'FOC', value: effectiveCharacter.focus, hint: 'Accuracy / Control', icon: 'focus' as StatIconType },
        ];
    }, [effectiveCharacter]);

    // ─── Fight flow (extracted hook) ────────────────────────────────────────
    const {
        matchmaking,
        combatData,
        canFight,
        handleFight,
        handleCombatComplete,
        handleCloseCombat,
    } = useFightFlow(isOfflineMode, fightsLeft, hasPendingFight, ensureConnection, openModal);

    // ─── XP gain notification ───────────────────────────────────────────────
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

    // ─── Level-up notification ──────────────────────────────────────────────
    useEffect(() => {
        if (lastLevelUp !== null) {
            setShowLevelUp(true);
            setDeferLevelUp(false);
        }
    }, [lastLevelUp]);

    // ─── Auto-close defer when points run out ──────────────────────────────
    useEffect(() => {
        if (pendingStatPoints === 0) {
            setDeferLevelUp(false);
        }
    }, [pendingStatPoints]);

    // ─── Handlers ───────────────────────────────────────────────────────────
    const handleAllocateStat = async (stat: StatKey) => {
        if (allocatingStat || pendingStatPoints <= 0) return;

        if (isOfflineMode) {
            openModal(connectionMessage);
            return;
        }

        setAllocatingStat(stat);
        try {
            await allocateStatPoint(stat);
        } catch (error: any) {
            openModal(error.message || connectionMessage);
        } finally {
            setAllocatingStat(null);
        }
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

    // ─── Guard: no character → redirect ────────────────────────────────────
    if (!activeCharacter || !effectiveCharacter) {
        setTimeout(() => navigate('/'), 100);
        return <div className="loading-screen">ACCESS DENIED</div>;
    }

    return (
        <div className="container retro-container arena-container">
            {/* Level Up overlay */}
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
                    <button
                        className="button icon-btn"
                        onClick={() => setSettingsOpen(true)}
                        title="Settings"
                        aria-label="Settings"
                    >
                        <PixelIcon type="gear" size={26} />
                    </button>
                    <button
                        className="button icon-btn inventory-btn"
                        onClick={() => setInventoryOpen(true)}
                        title="Inventory"
                        aria-label="Inventory"
                    >
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
                ensureConnection={ensureConnection}
            />

            <SettingsModal
                isOpen={settingsOpen}
                activeCharacter={activeCharacter}
                isOfflineMode={isOfflineMode}
                onClose={() => setSettingsOpen(false)}
                setAutoMode={setAutoMode}
                deleteCharacter={deleteCharacter}
                openModal={openModal}
                ensureConnection={(msg?: string) => ensureConnection(msg || connectionMessage)}
                navigate={navigate}
            />

            {combatData && (
                <CombatView
                    player={effectiveCharacter}
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
