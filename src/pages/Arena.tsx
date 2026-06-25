import { useCallback, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ActionPanel } from '../components/arena/ActionPanel';
import { ArenaHeader } from '../components/arena/ArenaHeader';
import { CharacterDisplay } from '../components/arena/CharacterDisplay';
import { InventoryPanel } from '../components/arena/InventoryPanel';
import { SettingsPanel } from '../components/arena/SettingsPanel';
import ConnectionModal from '../components/ConnectionModal';
import { CombatView } from '../components/CombatView';
import { useGame } from '../context/GameContext';
import { useArenaCombat } from '../hooks/useArenaCombat';
import { useArenaLevelUp } from '../hooks/useArenaLevelUp';
import { useConnectionGate } from '../hooks/useConnectionGate';
import { useIdleCombat } from '../hooks/useIdleCombat';
import { useInventory } from '../hooks/useInventory';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useSettings } from '../hooks/useSettings';
import { useSound } from '../hooks/useSound';
import { applyEquipmentToCharacter } from '../utils/equipmentUtils';
import type { ArenaIdleViewModel, ArenaStatOption } from '../components/arena/arenaTypes';

const connectionMessage = 'Connect to battle and sync your progress.';

const Arena = () => {
  const {
    activeCharacter,
    logout,
    useFight,
    usePveFight,
    startMatchmaking,
    lastXpGain,
    clearXpNotifications,
    dbAvailable,
    saveStatAllocations,
    saveEquipment,
    rollLootbox,
    setAutoMode,
    deleteCharacter,
    setCharacter,
    syncCharacterToBackend,
    essence,
    salvageItems,
  } = useGame();
  const { ensureConnection, openModal, closeModal, connectionModal } = useConnectionGate();
  const { play, enabled, setEnabled } = useSound();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const isOfflineMode = !isOnline || !dbAvailable;

  const levelUp = useArenaLevelUp({
    character: activeCharacter,
    lastXpGain,
    clearXpNotifications,
    setCharacter,
    saveStatAllocations,
    play,
  });

  const combat = useArenaCombat({
    character: activeCharacter,
    isOfflineMode,
    connectionMessage,
    ensureConnection,
    openModal,
    startMatchmaking,
    useFight,
    usePveFight,
    onLevelUp: levelUp.queueLevelUp,
  });

  const idle = useIdleCombat({
    character: activeCharacter,
    isPaused: !combat.pveMode,
    onCharacterUpdate: setCharacter,
    onSyncCharacter: syncCharacterToBackend,
    onLevelUp: levelUp.queueLevelUp,
  });

  const handleDeleted = useCallback(() => {
    setTimeout(() => navigate('/'), 0);
  }, [navigate]);

  const inventory = useInventory({
    character: activeCharacter,
    isOfflineMode,
    connectionMessage,
    ensureConnection,
    openModal,
    play,
    rollLootbox,
    setCharacter,
    saveEquipment,
  });

  const settings = useSettings({
    character: activeCharacter,
    isOfflineMode,
    connectionMessage,
    ensureConnection,
    openModal,
    setAutoMode,
    deleteCharacter,
    onDeleted: handleDeleted,
  });

  const effectiveCharacter = useMemo(
    () => activeCharacter ? applyEquipmentToCharacter(activeCharacter) : null,
    [activeCharacter],
  );

  const combatOpponent = useMemo(() => {
    if (!combat.combatData?.opponent) return null;
    return applyEquipmentToCharacter(combat.combatData.opponent);
  }, [combat.combatData?.opponent]);

  const statOptions: ArenaStatOption[] = useMemo(() => {
    if (!effectiveCharacter) return [];
    return [
      { key: 'strength', label: 'STR', value: effectiveCharacter.strength, hint: 'Damage', icon: 'strength' },
      { key: 'vitality', label: 'VIT', value: effectiveCharacter.vitality, hint: 'HP / Defense', icon: 'vitality' },
      { key: 'dexterity', label: 'DEX', value: effectiveCharacter.dexterity, hint: 'Speed', icon: 'dexterity' },
      { key: 'luck', label: 'LUK', value: effectiveCharacter.luck, hint: 'Crit Chance', icon: 'luck' },
      { key: 'intelligence', label: 'INT', value: effectiveCharacter.intelligence, hint: 'Magic Power', icon: 'intelligence' },
      { key: 'focus', label: 'FOC', value: effectiveCharacter.focus, hint: 'Accuracy / Control', icon: 'focus' },
    ];
  }, [effectiveCharacter]);

  const idleView: ArenaIdleViewModel = useMemo(() => ({
    currentMonster: idle.currentMonster,
    scenePhase: idle.scenePhase,
    lastCombatResult: idle.lastCombatResult,
    lastCombatXp: idle.lastCombatXp,
    offlineGains: idle.offlineGains,
    clearOfflineGains: idle.clearOfflineGains,
    recentLevelUp: levelUp.recentLevelUp,
    currentStreak: idle.currentStreak,
    streakMilestone: idle.efficiencyData?.streakMilestone ?? null,
    efficiency: idle.efficiencyData?.efficiency ?? null,
    xpPerMinute: idle.efficiencyData?.xpPerMinute ?? null,
    essencePerMinute: idle.efficiencyData?.essencePerMinute ?? null,
    powerRatio: idle.efficiencyData?.powerRatio ?? null,
    idleFightsCount: idle.idleFightsCount,
    totalKills: idle.totalKills,
    efficiencyData: idle.efficiencyData,
    remainingSeconds: idle.remainingSeconds,
  }), [
    idle.clearOfflineGains,
    idle.currentMonster,
    idle.currentStreak,
    idle.efficiencyData,
    idle.idleFightsCount,
    idle.lastCombatResult,
    idle.lastCombatXp,
    idle.offlineGains,
    idle.remainingSeconds,
    idle.scenePhase,
    idle.totalKills,
    levelUp.recentLevelUp,
  ]);

  const handleLogout = useCallback(() => {
    logout();
    setTimeout(() => navigate('/'), 0);
  }, [logout, navigate]);

  const handleOpenForge = useCallback(() => {
    navigate('/forge');
  }, [navigate]);

  const handleToggleSound = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  if (!activeCharacter || !effectiveCharacter) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container retro-container arena-container">
      <ArenaHeader
        characterName={activeCharacter.name}
        level={activeCharacter.level}
        essence={essence}
        onOpenSettings={settings.openSettings}
        onOpenInventory={inventory.openInventory}
        onOpenForge={handleOpenForge}
        onLogout={handleLogout}
      />

      <div className="arena-content">
        <CharacterDisplay
          character={activeCharacter}
          effectiveCharacter={effectiveCharacter}
          pveMode={combat.pveMode}
          xpBarAnimating={levelUp.xpBarAnimating}
          showXpGain={levelUp.showXpGain}
          lastXpGain={lastXpGain}
          statOptions={statOptions}
          idle={idleView}
        />
        <ActionPanel {...combat.actionPanelProps} />
      </div>

      <ConnectionModal open={connectionModal.open} message={connectionModal.message} onClose={closeModal} />

      {inventory.inventoryOpen && (
        <InventoryPanel
          {...inventory}
          itemUpgradeLevels={activeCharacter?.itemUpgrades ?? {}}
          essence={essence}
          onSalvage={salvageItems}
        />
      )}

      {settings.settingsOpen && (
        <SettingsPanel {...settings} soundEnabled={enabled} onToggleSound={handleToggleSound} />
      )}

      {!combat.pveMode && combat.combatData && combatOpponent && (
        <CombatView
          player={effectiveCharacter}
          opponent={combatOpponent}
          matchType={combat.combatData.matchType}
          monsterId={combat.combatData.matchType === 'pve' ? combat.pveMonster?.monsterId : undefined}
          candidates={combat.combatData.candidates}
          onComplete={combat.onCombatComplete}
          onClose={combat.onCloseCombat}
        />
      )}
    </div>
  );
};

export default Arena;
