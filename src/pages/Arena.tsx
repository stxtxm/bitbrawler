import { useNavigate, Navigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { useConnectionGate } from '../hooks/useConnectionGate';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useSound } from '../hooks/useSound';
import { useIdleCombat } from '../hooks/useIdleCombat';
import ConnectionModal from '../components/ConnectionModal';
import { PixelCharacter } from '../components/PixelCharacter';
import { PixelIcon } from '../components/PixelIcon';
import { PixelItemIcon } from '../components/PixelItemIcon';
import { getXpProgress, formatXpDisplay, getMaxLevel } from '../utils/xpUtils';
import { StatKey, STAT_TOOLTIPS, autoAllocateStatPoints } from '../utils/statUtils';
import { CombatView } from '../components/CombatView';
import { IdleRunnerScene } from '../components/IdleRunnerScene';
import { MatchmakingResult } from '../utils/matchmakingUtils';
import { applyEquipmentToCharacter, getEquipmentBonuses, getItemById, getEquippedItems, equipItem, unequipItem } from '../utils/equipmentUtils';
import { canRollLootbox } from '../utils/lootboxUtils';
import { SettingsLogEntry, formatSettingsLogDate } from '../utils/arenaUtils';
import StreakIndicator from '../components/StreakIndicator';
import { INVENTORY_CAPACITY } from '../utils/persistenceUtils';
import { ItemSlot, ItemStats, PixelItemAsset } from '../types/Item';
import { AffinityBadge } from '../components/AffinityBadge';
import LevelUpOverlay from '../components/LevelUpOverlay';
import { GAME_RULES } from '../config/gameRules';
import { generateMonsterForPlayer, getMonsterDef } from '../utils/monsterUtils';
import { MonsterId } from '../data/monsterAssets';


const Arena = () => {
    const { activeCharacter, logout, useFight, usePveFight, startMatchmaking, lastXpGain, lastLevelUp, clearXpNotifications, dbAvailable, allocateStatPoint, saveStatAllocations, saveEquipment, rollLootbox, setAutoMode, deleteCharacter, setCharacter } = useGame();
    const { ensureConnection, openModal, closeModal, connectionModal } = useConnectionGate();
    const { play, enabled, setEnabled } = useSound();
    const navigate = useNavigate();
    const isOnline = useOnlineStatus();
    const connectionMessage = 'Connect to battle and sync your progress.';

    const [showXpGain, setShowXpGain] = useState(false);
    const [showLevelUp, setShowLevelUp] = useState(false);
    const [xpBarAnimating, setXpBarAnimating] = useState(false);
    const [inventoryOpen, setInventoryOpen] = useState(false);
    const [matchmaking, setMatchmaking] = useState(false);
    const [combatData, setCombatData] = useState<MatchmakingResult | null>(null);
    const [saving, setSaving] = useState(false);
    const [lootboxRolling, setLootboxRolling] = useState(false);
    const [lootboxResult, setLootboxResult] = useState<PixelItemAsset | null>(null);
    const [inventoryHoveredId, setInventoryHoveredId] = useState<string | null>(null);
    const [inventorySelectedId, setInventorySelectedId] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsView, setSettingsView] = useState<'main' | 'logs'>('main');
    const [autoModeUpdating, setAutoModeUpdating] = useState(false);
    const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm'>('idle');
    const [deletePending, setDeletePending] = useState(false);
    const [pveMode, setPveMode] = useState(true);
    const [pveMonster, setPveMonster] = useState<{ monsterId: MonsterId; monsterDef: ReturnType<typeof getMonsterDef> } | null>(null);

    const idle = useIdleCombat({
        character: activeCharacter,
        isPaused: !pveMode,
        onCharacterUpdate: setCharacter,
    });

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
        }
    }, [lastLevelUp]);

    // Clear level-up notification on unmount to prevent stale popup
    // when navigating back to Arena after a failed saveStatAllocations
    useEffect(() => {
        return () => {
            clearXpNotifications();
        };
    }, [clearXpNotifications]);

    // Auto-allocate stat points in auto-mode to prevent the level-up overlay
    // from blocking the FIGHT button (QA runs fail 21%+ of the time otherwise)
    useEffect(() => {
        if (!activeCharacter?.autoMode) return;
        const points = activeCharacter.statPoints || 0;
        if (points <= 0) return;

        const updated = autoAllocateStatPoints(activeCharacter, points);
        setCharacter(updated);
        setShowLevelUp(false);
        clearXpNotifications();

        // Persist auto-allocated stats to the DB so they survive reconnect
        const allocations: Partial<Record<StatKey, number>> = {};
        const statKeys: StatKey[] = ['strength', 'vitality', 'dexterity', 'luck', 'intelligence', 'focus'];
        for (const key of statKeys) {
            const delta = (updated as any)[key] - (activeCharacter as any)[key];
            if (delta > 0) allocations[key] = delta;
        }
        if (Object.keys(allocations).length > 0) {
            saveStatAllocations(allocations).catch((err) =>
                console.error('Auto-allocate DB save failed:', err)
            );
        }
    }, [activeCharacter?.autoMode, activeCharacter?.statPoints, setCharacter, clearXpNotifications, saveStatAllocations]);

    // Defensive overlay dismissal: when auto-mode is active and the character
    // has zero pending stat points, force-dismiss the level-up overlay.
    // This catches race conditions where the overlay stays visible after
    // auto-allocation completes (e.g., server-side allocation in useFight,
    // or stale showLevelUp state that wasn't cleared).
    useEffect(() => {
        if (!activeCharacter?.autoMode) return;
        if ((activeCharacter.statPoints || 0) > 0) return;

        setShowLevelUp(false);
        clearXpNotifications();
    }, [activeCharacter?.autoMode, activeCharacter?.statPoints, clearXpNotifications]);

    if (!activeCharacter) {
        return <Navigate to="/" replace />;
    }

    const effectiveCharacter = applyEquipmentToCharacter(activeCharacter);
    const xpProgress = getXpProgress(activeCharacter);
    const isMaxLevel = activeCharacter.level >= getMaxLevel();
    const isOfflineMode = !isOnline || !dbAvailable;
    const fightsLeft = activeCharacter.fightsLeft || 0;
    const pveFightsLeft = activeCharacter.pveFightsLeft ?? 5;
    const hasPendingFight = !!activeCharacter.pendingFight;
    const canFight = !isOfflineMode && !hasPendingFight && !activeCharacter?.autoMode && (pveMode ? pveFightsLeft > 0 : fightsLeft > 0);
    const pointsRemaining = activeCharacter.statPoints || 0;
    const shouldShowLevelUp = showLevelUp && pointsRemaining > 0;
    const inventory = activeCharacter.inventory || [];
    const inventoryCapacity = INVENTORY_CAPACITY;
    const inventoryFull = inventory.length >= inventoryCapacity;
    const canRollDailyLoot = canRollLootbox(activeCharacter.lastLootRoll, Date.now());
    const streak = activeCharacter.lootboxStreak ?? 0;
    type StatIconType = 'strength' | 'vitality' | 'dexterity' | 'luck' | 'intelligence' | 'focus';
    const statOptions: Array<{ key: StatKey; label: string; value: number; hint: string; icon: StatIconType }> = [
        { key: 'strength', label: 'STR', value: effectiveCharacter.strength, hint: 'Damage', icon: 'strength' },
        { key: 'vitality', label: 'VIT', value: effectiveCharacter.vitality, hint: 'HP / Defense', icon: 'vitality' },
        { key: 'dexterity', label: 'DEX', value: effectiveCharacter.dexterity, hint: 'Speed', icon: 'dexterity' },
        { key: 'luck', label: 'LUK', value: effectiveCharacter.luck, hint: 'Crit Chance', icon: 'luck' },
        { key: 'intelligence', label: 'INT', value: effectiveCharacter.intelligence, hint: 'Magic Power', icon: 'intelligence' },
        { key: 'focus', label: 'FOC', value: effectiveCharacter.focus, hint: 'Accuracy / Control', icon: 'focus' },
    ];

    const itemStatMeta: Record<keyof ItemStats, { label: string; icon: StatIconType }> = {
        strength: { label: 'STR', icon: 'strength' },
        vitality: { label: 'VIT', icon: 'vitality' },
        dexterity: { label: 'DEX', icon: 'dexterity' },
        luck: { label: 'LUK', icon: 'luck' },
        intelligence: { label: 'INT', icon: 'intelligence' },
        focus: { label: 'FOC', icon: 'focus' },
        hp: { label: 'HP', icon: 'vitality' },
    };
    const previewItemId = inventoryHoveredId ?? inventorySelectedId ?? undefined;
    const previewItem = getItemById(previewItemId);
    const previewStats = previewItem
        ? (Object.entries(previewItem.stats)
            .filter(([, value]) => typeof value === 'number' && value !== 0) as [keyof ItemStats, number][])
        : [];
    const lootboxStats = lootboxResult
        ? (Object.entries(lootboxResult.stats)
            .filter(([, value]) => typeof value === 'number' && value !== 0) as [keyof ItemStats, number][])
        : [];
    const previewSlotLabel = previewItem ? previewItem.slot.toUpperCase() : '';
    const equippedItems = getEquippedItems(activeCharacter);
    const totalBonus = getEquipmentBonuses(activeCharacter);
    const bonusOrder: Array<keyof ItemStats> = ['strength', 'vitality', 'dexterity', 'luck', 'intelligence', 'focus', 'hp'];
    const totalBonusEntries = bonusOrder
        .map((key) => ({ key, value: totalBonus[key] || 0 }))
        .filter((entry) => entry.value > 0);
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

    const handleAllocateStat = async (stat: StatKey) => {
        if (saving) return;
        if (pointsRemaining <= 0) return;
        setSaving(true);
        try {
            await allocateStatPoint(stat);
        } catch (error: any) {
            openModal(error.message || connectionMessage);
        } finally {
            setSaving(false);
        }
    };

    const handleDismissLevelUp = () => {
        setShowLevelUp(false);
        clearXpNotifications();
    };

    const handleOpenLevelUp = () => {
        setShowLevelUp(true);
    };

    const handleEquipItem = (itemId: string, slot: ItemSlot) => {
        if (!activeCharacter) return;
        const updated = equipItem(activeCharacter, itemId, slot);
        setCharacter(updated);
        saveEquipment(updated).catch((err) =>
            console.error('Equipment DB save failed:', err)
        );
        setInventoryHoveredId(null);
        setInventorySelectedId(null);
    };

    const handleUnequipItem = (slot: ItemSlot) => {
        if (!activeCharacter) return;
        const updated = unequipItem(activeCharacter, slot);
        setCharacter(updated);
        saveEquipment(updated).catch((err) =>
            console.error('Equipment DB save failed:', err)
        );
    };

    useEffect(() => {
        if (!inventoryOpen) {
            setLootboxResult(null);
            setLootboxRolling(false);
            setInventoryHoveredId(null);
            setInventorySelectedId(null);
        }
    }, [inventoryOpen]);

    useEffect(() => {
        if (!settingsOpen) {
            setSettingsView('main');
            setDeleteStep('idle');
            setDeletePending(false);
        }
    }, [settingsOpen]);

    // Level-up sound
    useEffect(() => {
        if (shouldShowLevelUp) {
            play('levelup');
        }
    }, [shouldShowLevelUp, play]);

    const handleLootboxRoll = async () => {
        if (lootboxRolling) return;
        if (isOfflineMode) {
            openModal(connectionMessage);
            return;
        }
        const canProceed = await ensureConnection(connectionMessage);
        if (!canProceed) return;

        setLootboxRolling(true);
        setLootboxResult(null);
        play('lootbox');

        setTimeout(async () => {
            try {
                const item = await rollLootbox();
                if (item) {
                    setLootboxResult(item);
                    setInventorySelectedId(item.id);
                    setInventoryHoveredId(item.id);
                    setTimeout(() => play('loot'), 100);
                }
            } catch (error: any) {
                openModal(error.message || connectionMessage);
            } finally {
                setLootboxRolling(false);
            }
        }, 900);
    };

    const handleCloseLootboxResult = () => {
        setLootboxResult(null);
    };

    const handleSelectItem = (itemId: string) => {
        setInventorySelectedId(itemId);
    };

    const handleOpenHistoryFromSettings = () => {
        setSettingsView('logs');
    };

    const handleReturnToSettings = () => {
        setSettingsView('main');
    };

    const autoModeEnabled = !!activeCharacter?.autoMode;

    const handleToggleAutoMode = async () => {
        if (autoModeUpdating) return;
        if (isOfflineMode) {
            openModal(connectionMessage);
            return;
        }
        const canProceed = await ensureConnection(connectionMessage);
        if (!canProceed) return;

        setAutoModeUpdating(true);
        try {
            await setAutoMode(!autoModeEnabled);
        } catch (error: any) {
            openModal(error.message || connectionMessage);
        } finally {
            setAutoModeUpdating(false);
        }
    };

    const handleDeleteCharacter = async () => {
        if (deletePending) return;
        if (deleteStep === 'idle') {
            setDeleteStep('confirm');
            return;
        }
        if (isOfflineMode) {
            openModal(connectionMessage);
            return;
        }
        const canProceed = await ensureConnection(connectionMessage);
        if (!canProceed) return;

        setDeletePending(true);
        try {
            await deleteCharacter();
            setSettingsOpen(false);
            setTimeout(() => navigate('/'), 0);
        } catch (error: any) {
            openModal(error.message || connectionMessage);
        } finally {
            setDeletePending(false);
        }
    };

    const handleFight = async () => {
        if (matchmaking || hasPendingFight || activeCharacter?.autoMode) return;
        const canProceed = await ensureConnection(connectionMessage);
        if (!canProceed) return;

        if (window.navigator.vibrate) window.navigator.vibrate(80);

        if (pveMode) {
            setMatchmaking(true);
            try {
                const { character, def } = generateMonsterForPlayer(activeCharacter!.level);
                setPveMonster({ monsterId: def.id, monsterDef: def });
                setCombatData({
                    opponent: character,
                    matchType: 'pve',
                    candidates: [],
                });
                setMatchmaking(false);
            } catch (error) {
                console.error('Monster generation failed:', error);
                openModal(connectionMessage);
                setMatchmaking(false);
            }
            return;
        }

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
            if (combatData?.matchType === 'pve') {
                const pveXp = Math.round(xpGained * GAME_RULES.PVE.XP_MODIFIER);
                await usePveFight(won, pveXp, opponentName);
            } else {
                const opponentId = combatData?.opponent.id || '';
                await useFight(won, xpGained, opponentName, opponentId);
            }
        } catch (error: any) {
            console.error('Fight result save failed:', error);
            openModal(error.message || connectionMessage);
        }
    };

    const handleCloseCombat = () => {
        setCombatData(null);
        setPveMonster(null);
    };


    return (
        <div className="container retro-container arena-container">
            <LevelUpOverlay
                shouldShowLevelUp={shouldShowLevelUp}
                activeCharacter={activeCharacter}
                lastLevelUp={lastLevelUp}
                isOfflineMode={isOfflineMode}
                statOptions={statOptions}
                saving={saving}
                onAllocateStat={handleAllocateStat}
                onClose={handleDismissLevelUp}
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
                {pveMode ? (
                    <>
                        <div className="character-display">
                            <IdleRunnerScene
                                character={effectiveCharacter}
                                isDead={idle.isDead}
                                idleHp={idle.idleHp}
                                idleMaxHp={idle.idleMaxHp}
                                idleXpGained={idle.idleXpGained}
                                idleFightsCount={idle.idleFightsCount}
                                currentMonster={idle.currentMonster}
                                backgroundMonster={idle.backgroundMonster}
                                scenePhase={idle.scenePhase}
                                lastCombatResult={idle.lastCombatResult}
                                lastCombatXp={idle.lastCombatXp}
                                onResume={idle.resume}
                                offlineGains={idle.offlineGains}
                                onClearOfflineGains={idle.clearOfflineGains}
                            />
                        </div>
                        <div className="action-panel">
                            <div className="pve-toggle-row">
                                <button
                                    className={`pixel-switch pve-switch ${pveMode ? 'on' : 'off'}`}
                                    onClick={() => setPveMode(true)}
                                    role="switch"
                                    aria-checked={pveMode}
                                    aria-label="PvE mode"
                                >
                                    <span className="switch-knob" />
                                    <span className="switch-text">👹 PVE</span>
                                </button>
                                <button
                                    className={`pixel-switch pve-switch ${!pveMode ? 'on' : 'off'}`}
                                    onClick={() => setPveMode(false)}
                                    role="switch"
                                    aria-checked={!pveMode}
                                    aria-label="PvP mode"
                                >
                                    <span className="switch-knob" />
                                    <span className="switch-text">⚔ PVP</span>
                                </button>
                            </div>
                            <div className="xp-section" style={{ margin: 0 }}>
                                <div className="xp-header">
                                    <span className="xp-label">EXP</span>
                                    <span className="xp-text">{formatXpDisplay(activeCharacter)}</span>
                                </div>
                                <div className="xp-bar-container">
                                    <div
                                        className={`xp-bar ${xpBarAnimating ? 'animating' : ''} ${isMaxLevel ? 'max-level' : ''}`}
                                        style={{ width: `${xpProgress.percentage}%` }}
                                    >
                                        <div className="xp-bar-shine"></div>
                                    </div>
                                    {showXpGain && lastXpGain && (
                                        <div className="xp-gain-popup">+{lastXpGain} XP</div>
                                    )}
                                </div>
                                {isMaxLevel && <span className="max-level-badge">★ MAX LEVEL ★</span>}
                            </div>
                            <div className="stats-grid-compact" style={{ gap: 2 }}>
                                {statOptions.map((stat) => (
                                    <div key={stat.key} className="compact-stat" title={`${stat.label}: ${STAT_TOOLTIPS[stat.key as StatKey]}`}>
                                        <span className="compact-stat-icon">
                                            <PixelIcon type={stat.icon} size={10} />
                                        </span>
                                        <span className="compact-stat-label">{stat.label}</span>
                                        <span className="compact-stat-value">{stat.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="character-display">
                            <div className="avatar-box">
                                <PixelCharacter seed={activeCharacter.seed} gender={activeCharacter.gender} scale={window.innerWidth < 600 ? 16 : 12} />
                            </div>

                            <div className="xp-section">
                                <div className="xp-header">
                                    <span className="xp-label">EXP</span>
                                    <span className="xp-text">{formatXpDisplay(activeCharacter)}</span>
                                </div>
                                <div className="xp-bar-container">
                                    <div
                                        className={`xp-bar ${xpBarAnimating ? 'animating' : ''} ${isMaxLevel ? 'max-level' : ''}`}
                                        style={{ width: `${xpProgress.percentage}%` }}
                                    >
                                        <div className="xp-bar-shine"></div>
                                    </div>
                                    {showXpGain && lastXpGain && (
                                        <div className="xp-gain-popup">+{lastXpGain} XP</div>
                                    )}
                                </div>
                                {isMaxLevel && <span className="max-level-badge">★ MAX LEVEL ★</span>}
                            </div>

                            <div className="stats-panel">
                                <div className="stat-row principal">
                                    <span>HP</span>
                                    <div className="bar-container">
                                        <div className="bar hp-bar" style={{ width: `${(effectiveCharacter.hp / effectiveCharacter.maxHp) * 100}%` }}></div>
                                    </div>
                                    <span className="stat-val">{effectiveCharacter.maxHp}</span>
                                </div>
                                <div className="stats-grid-compact">
                                    {statOptions.map((stat) => (
                                        <div key={stat.key} className="compact-stat" title={`${stat.label}: ${STAT_TOOLTIPS[stat.key as StatKey]}`}>
                                            <span className="compact-stat-icon">
                                                <PixelIcon type={stat.icon} size={12} />
                                            </span>
                                            <span className="compact-stat-label">{stat.label}</span>
                                            <span className="compact-stat-value">{stat.value}</span>
                                        </div>
                                    ))}
                                </div>
                                {pointsRemaining > 0 && (
                                    <button
                                        className="button secondary-btn stat-allocate-btn"
                                        onClick={handleOpenLevelUp}
                                    >
                                        SPEND POINT
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="action-panel">
                            <div className="pve-toggle-row">
                                <button
                                    className={`pixel-switch pve-switch ${pveMode ? 'on' : 'off'}`}
                                    onClick={() => setPveMode(true)}
                                    role="switch"
                                    aria-checked={pveMode}
                                    aria-label="PvE mode"
                                >
                                    <span className="switch-knob" />
                                    <span className="switch-text">👹 PVE</span>
                                </button>
                                <button
                                    className={`pixel-switch pve-switch ${!pveMode ? 'on' : 'off'}`}
                                    onClick={() => setPveMode(false)}
                                    role="switch"
                                    aria-checked={!pveMode}
                                    aria-label="PvP mode"
                                >
                                    <span className="switch-knob" />
                                    <span className="switch-text">⚔ PVP</span>
                                </button>
                            </div>

                            <div className="daily-status-compact">
                                <div className="status-label">
                                    <PixelIcon type="sword" size={32} />
                                    <div className="label-text">
                                        <span className="label-main">BATTLE ENERGY</span>
                                        <span className="label-sub">
                                            {isOfflineMode
                                                ? 'OFFLINE SNAPSHOT'
                                                : `${fightsLeft} / ${GAME_RULES.COMBAT.MAX_DAILY_FIGHTS} AVAILABLE`}
                                        </span>
                                    </div>
                                </div>
                                <div className="mini-pips">
                                    {Array.from({ length: GAME_RULES.COMBAT.MAX_DAILY_FIGHTS }).map((_, i) => (
                                        <div key={i} className={`mini-pip ${i < fightsLeft ? 'active' : 'used'}`}></div>
                                    ))}
                                </div>
                            </div>

                            <button
                                className="button primary-btn giant-btn"
                                disabled={!canFight || matchmaking}
                                onClick={handleFight}
                            >
                            {matchmaking
                                ? 'SEARCHING...'
                                : hasPendingFight
                                    ? 'RESOLVING...'
                                    : activeCharacter?.autoMode
                                        ? 'AUTO MODE'
                                        : (isOfflineMode
                                            ? 'OFFLINE'
                                            : (fightsLeft > 0 ? 'FIGHT!' : 'REST NOW'))}
                            </button>
                        </div>
                    </>
                )}
            </div>
            <ConnectionModal
                open={connectionModal.open}
                message={connectionModal.message}
                onClose={closeModal}
            />
            {inventoryOpen && (
                <div className="retro-modal-overlay inventory-overlay" onClick={() => setInventoryOpen(false)}>
                    <div className={`retro-modal inventory-modal ${lootboxRolling ? 'lootbox-active' : ''}`} onClick={(e) => e.stopPropagation()}>
                        <div className="inventory-header">
                            <h2 className="inventory-title">INVENTORY</h2>
                            <button className="inventory-close" onClick={() => setInventoryOpen(false)} aria-label="Close inventory">
                                ×
                            </button>
                        </div>
                        <div className="inventory-roll">
                            <button
                                className="button lootbox-btn"
                                onClick={handleLootboxRoll}
                                disabled={lootboxRolling || !canRollDailyLoot || inventoryFull || isOfflineMode}
                                aria-label="Daily lootbox roll"
                            >
                                <PixelIcon type="chest" size={18} />
                                <span>
                                    {lootboxRolling
                                        ? 'OPENING...'
                                        : inventoryFull
                                            ? 'INVENTORY FULL'
                                            : canRollDailyLoot
                                                ? 'DAILY LOOTBOX'
                                                : 'COME BACK TOMORROW'}
                                </span>
                            </button>
                            <div className="lootbox-status">
                                {inventory.length}/{inventoryCapacity} SLOTS
                            </div>
                            <StreakIndicator streak={streak} canRoll={canRollDailyLoot} />
                        </div>
                        <div className="inventory-body">
                            <div className="inv-loadout">
                                <div className="inv-loadout-label">EQUIPPED</div>
                                <div className="inv-loadout-slots">
                                    {(['weapon', 'armor', 'accessory'] as ItemSlot[]).map((slot) => {
                                        const item = equippedItems.find(i => i.slot === slot);
                                        return (
                                            <div key={slot} className={`inv-loadout-slot ${item ? 'filled' : 'empty'}`}>
                                                <span className="inv-loadout-slot-icon">
                                                    {slot === 'weapon' ? '⚔️' : slot === 'armor' ? '🛡️' : '💍'}
                                                </span>
                                                {item ? (
                                                    <div className="inv-loadout-item">
                                                        <PixelItemIcon pixels={item.pixels} size={22} />
                                                        {item.element && <AffinityBadge element={item.element} size={10} />}
                                                        <div className="inv-loadout-item-name">{item.name}</div>
                                                        <button
                                                            className="inv-unequip-btn"
                                                            onClick={() => handleUnequipItem(slot)}
                                                            title="Unequip"
                                                            aria-label={`Unequip ${item.name}`}
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="inv-loadout-empty">EMPTY</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="inv-body-content">
                                <div className="inv-groups">
                                    {(['weapon', 'armor', 'accessory'] as ItemSlot[]).map((slot) => {
                                        const slotItems = inventory
                                            .map((id) => getItemById(id))
                                            .filter((item): item is PixelItemAsset => Boolean(item))
                                            .filter((item) => item.slot === slot);
                                        if (slotItems.length === 0) return null;
                                        return (
                                            <div key={slot} className="inv-group">
                                                <div className="inv-group-label">
                                                    {slot === 'weapon' ? '⚔️ WEAPONS' : slot === 'armor' ? '🛡️ ARMOR' : '💍 ACCESSORIES'}
                                                </div>
                                                <div className="inv-group-grid">
                                                    {slotItems.map((item) => {
                                                        const isSelected = previewItemId === item.id;
                                                        return (
                                                            <button
                                                                key={item.id}
                                                                className={`inv-group-item rarity-${item.rarity} ${isSelected ? 'selected' : ''}`}
                                                                onClick={() => {
                                                                    handleEquipItem(item.id, slot);
                                                                    handleSelectItem(item.id);
                                                                }}
                                                                onMouseEnter={() => setInventoryHoveredId(item.id)}
                                                                onMouseLeave={() => setInventoryHoveredId((current) => (current === item.id ? null : current))}
                                                                onFocus={() => setInventoryHoveredId(item.id)}
                                                                onBlur={() => setInventoryHoveredId((current) => (current === item.id ? null : current))}
                                                                onTouchStart={() => setInventorySelectedId(item.id)}
                                                                title={`Equip ${item.name}`}
                                                                aria-label={`Equip ${item.name}`}
                                                            >
                                                                <PixelItemIcon pixels={item.pixels} size={22} />
                                                                {item.element && <AffinityBadge element={item.element} size={8} />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {inventory.length === 0 && (
                                        <div className="inv-empty">No items in inventory. Open the daily lootbox!</div>
                                    )}
                                </div>
                                <div className={`inventory-details ${previewItem ? '' : 'empty'}`}>
                                    {previewItem ? (
                                        <>
                                            <div className={`inventory-item-head rarity-${previewItem.rarity}`}>
                                                <PixelItemIcon pixels={previewItem.pixels} size={30} />
                                                <div className="inventory-item-meta">
                                                    <div className="inventory-item-name">{previewItem.name}</div>
                                                    <div className="inventory-item-sub">
                                                        <span className="inventory-item-slot">{previewSlotLabel}</span>
                                                        <span className="inventory-item-rarity">{previewItem.rarity.toUpperCase()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="inventory-item-stats">
                                                {previewStats.map(([statKey, value]) => {
                                                    const meta = itemStatMeta[statKey];
                                                    if (!meta) return null;
                                                    return (
                                                        <div key={statKey} className="inventory-stat-row">
                                                            <span className="inventory-stat-icon">
                                                                <PixelIcon type={meta.icon} size={12} />
                                                            </span>
                                                            <span className="inventory-stat-label">{meta.label}</span>
                                                            <span className="inventory-stat-value">+{value}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="inventory-empty-details">TAP AN ITEM TO VIEW BONUSES</div>
                                    )}
                                    {totalBonusEntries.length > 0 && (
                                        <div className="inventory-bonus-summary">
                                            <div className="bonus-title">TOTAL BONUS</div>
                                            <div className="bonus-list">
                                                {totalBonusEntries.map((entry) => {
                                                    const meta = itemStatMeta[entry.key];
                                                    if (!meta) return null;
                                                    return (
                                                        <div key={entry.key} className="bonus-chip">
                                                            <PixelIcon type={meta.icon} size={10} />
                                                            <span className="bonus-label">{meta.label}</span>
                                                            <span className="bonus-value">+{entry.value}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        {lootboxResult && (
                            <div className="lootbox-result-overlay" role="dialog" aria-label="Lootbox reward" onClick={handleCloseLootboxResult}>
                                <div className={`lootbox-result-card rarity-${lootboxResult.rarity}`} onClick={handleCloseLootboxResult}>
                                    <div className="lootbox-result-glow"></div>
                                    <div className="lootbox-result-title">NEW ITEM</div>
                                    <div className="lootbox-result-item">
                                        <div className="lootbox-result-icon">
                                            <PixelItemIcon pixels={lootboxResult.pixels} size={64} />
                                        </div>
                                        <div className="lootbox-result-meta">
                                            <div className="lootbox-result-name">{lootboxResult.name}</div>
                                            <div className="lootbox-result-rarity">{lootboxResult.rarity.toUpperCase()}</div>
                                        </div>
                                    </div>
                                    <div className="lootbox-result-stats">
                                        {lootboxStats.map(([statKey, value]) => {
                                            const meta = itemStatMeta[statKey];
                                            if (!meta) return null;
                                            return (
                                                <div key={statKey} className="lootbox-result-stat">
                                                    <PixelIcon type={meta.icon} size={12} />
                                                    <span className="lootbox-stat-label">{meta.label}</span>
                                                    <span className="lootbox-stat-value">+{value}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="lootbox-result-hint">TAP TO CONTINUE</div>
                                </div>
                            </div>
                        )}
                        {lootboxRolling && (
                            <div className="lootbox-overlay">
                                <div className="lootbox-anim">
                                    <PixelIcon type="chest" size={46} />
                                    <div className="lootbox-text">OPENING...</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {settingsOpen && (
                <div className="retro-modal-overlay settings-overlay" onClick={() => setSettingsOpen(false)}>
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
                            <button className="inventory-close" onClick={() => setSettingsOpen(false)} aria-label="Close settings">
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
                                                className={`pixel-switch ${enabled ? 'on' : 'off'}`}
                                                onClick={() => setEnabled(!enabled)}
                                                role="switch"
                                                aria-checked={enabled}
                                                aria-label="Sound"
                                            >
                                                <span className="switch-knob" />
                                                <span className="switch-text">{enabled ? 'ON' : 'OFF'}</span>
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
            )}
            {!pveMode && combatData && activeCharacter && (
                <CombatView
                    player={applyEquipmentToCharacter(activeCharacter)}
                    opponent={applyEquipmentToCharacter(combatData.opponent)}
                    matchType={combatData.matchType}
                    monsterId={combatData.matchType === 'pve' ? pveMonster?.monsterId : undefined}
                    candidates={combatData.candidates}
                    onComplete={handleCombatComplete}
                    onClose={handleCloseCombat}
                />
            )}
        </div>
    );
};

export default Arena;
