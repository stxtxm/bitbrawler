import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useNotification } from '../../hooks/useNotification';
import { getBestiaryProgress, type BestiaryEntry } from '../../utils/bestiaryUtils';
import { getCodexHint, getCodexIds, getCodexProgress } from '../../utils/codexUtils';
import { CODEX_ENTRIES, getCodexEntry, type CodexEntry } from '../../data/codex';
import { ITEM_ASSETS } from '../../data/itemAssets';
import { MONSTER_ASSETS, type MonsterId } from '../../data/monsterAssets';
import { ELEMENT_LABELS } from '../../types/Item';
import type { Character } from '../../types/Character';
import { PixelItemIcon } from '../PixelItemIcon';
import { PixelMonster } from '../PixelMonster';

type CompendiumTab = 'bestiary' | 'armory';

interface CompendiumPanelProps {
  onClose?: () => void;
}

interface CompendiumSnapshot {
  monsters: Set<string>;
  items: Set<string>;
}

const EMPTY_ARMORY_PROGRESS = {
  seen: 0,
  owned: 0,
  total: CODEX_ENTRIES.length,
  completionPct: 0,
};

function computeGlobalPercentage(
  bestiarySeen: number,
  armorySeen: number,
  bestiaryTotal: number,
  armoryTotal: number,
): number {
  const total = bestiaryTotal + armoryTotal;
  if (total <= 0) return 0;
  return Math.round(((bestiarySeen + armorySeen) / total) * 100);
}

function createSnapshot(character: Character | null): CompendiumSnapshot | null {
  if (!character) return null;
  const monsters = new Set(
    Object.entries(character.monsterKills ?? {})
      .filter(([, kills]) => kills > 0)
      .map(([id]) => id),
  );
  return { monsters, items: new Set(getCodexIds(character)) };
}

function BestiaryTile({ entry }: { entry: BestiaryEntry }) {
  const monster = MONSTER_ASSETS.find((asset) => asset.id === entry.id);
  const stateClass = entry.seen ? 'medal-card--unlocked' : 'medal-card--locked';

  return (
    <div className={`medal-card compendium-card ${stateClass}`}>
      <div className="medal-card__header">
        <div className="medal-card__icon compendium-card__visual">
          <div style={entry.seen ? undefined : { filter: 'brightness(0)', opacity: 0.45 }}>
            <PixelMonster monsterId={entry.id as MonsterId} scale={2} />
          </div>
        </div>
        <div className="medal-card__info">
          <h3 className="medal-card__name">{entry.seen ? entry.name : '???'}</h3>
          {entry.seen && (
            <p className="medal-card__description">
              {ELEMENT_LABELS[entry.element]}
              {monster ? ` · ${monster.specialty}` : ''}
              {` · ${entry.kills} kill${entry.kills > 1 ? 's' : ''}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ArmoryTile({ entry, discovered, seenSet }: {
  entry: CodexEntry;
  discovered: boolean;
  seenSet: Set<string>;
}) {
  const asset = ITEM_ASSETS.find((item) => item.id === entry.id);
  const hint = getCodexHint(entry.id, seenSet);
  const stateClass = discovered ? 'medal-card--unlocked' : 'medal-card--locked';

  return (
    <div className={`medal-card compendium-card ${stateClass}`}>
      <div className="medal-card__header">
        <div className="medal-card__icon compendium-card__visual">
          {discovered && asset ? (
            <PixelItemIcon pixels={asset.pixels} size={28} />
          ) : (
            <span className="compendium-card__locked">?</span>
          )}
        </div>
        <div className="medal-card__info">
          <h3 className="medal-card__name">{discovered ? entry.name : '???'}</h3>
          <p className="medal-card__description">
            {discovered ? `${entry.rarity.toUpperCase()} · ${entry.slot.toUpperCase()}` : hint}
          </p>
        </div>
      </div>
    </div>
  );
}

export const CompendiumPanel = ({ onClose }: CompendiumPanelProps) => {
  const { activeCharacter } = useGame();
  const { notify } = useNotification();
  const [activeTab, setActiveTab] = useState<CompendiumTab>('bestiary');
  const snapshotRef = useRef<CompendiumSnapshot | null>(null);

  const character = activeCharacter ?? null;
  const bestiary = useMemo(() => getBestiaryProgress(character ?? {}), [character]);
  const armory = useMemo(
    () => (character ? getCodexProgress(character) : EMPTY_ARMORY_PROGRESS),
    [character],
  );
  const armoryIds = useMemo(() => (character ? getCodexIds(character) : []), [character]);
  const armorySeenSet = useMemo(() => new Set(armoryIds), [armoryIds]);

  const globalPct = computeGlobalPercentage(
    bestiary.seen,
    armory.seen,
    bestiary.total,
    armory.total,
  );

  useEffect(() => {
    const current = createSnapshot(character);
    const previous = snapshotRef.current;
    snapshotRef.current = current;
    if (!current || !previous) return;

    current.monsters.forEach((id) => {
      if (previous.monsters.has(id)) return;
      const entry = bestiary.entries.find((monster) => monster.id === id);
      notify(`Nouveau : ${entry?.name ?? id} débloqué !`, 'success', 3000);
    });

    current.items.forEach((id) => {
      if (previous.items.has(id)) return;
      notify(`Nouveau : ${getCodexEntry(id)?.name ?? id} débloqué !`, 'success', 3000);
    });
  }, [character, bestiary.entries, notify]);

  return (
    <div className="compendium-panel">
      <div className="compendium-global">
        <div className="compendium-global__value" data-testid="compendium-global-pct">
          {globalPct}%
        </div>
        <div className="compendium-global__label">COLLECTION COMPLETE</div>
        <div className="compendium-global__counts">
          {bestiary.seen + armory.seen} / {bestiary.total + armory.total}
        </div>
      </div>

      <div className="settings-medals-categories" role="tablist" aria-label="Compendium sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'bestiary'}
          className={`settings-medals-category-btn ${activeTab === 'bestiary' ? 'active' : ''}`}
          onClick={() => setActiveTab('bestiary')}
        >
          BESTIARY {bestiary.seen}/{bestiary.total}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'armory'}
          className={`settings-medals-category-btn ${activeTab === 'armory' ? 'active' : ''}`}
          onClick={() => setActiveTab('armory')}
        >
          ARMORY {armory.seen}/{armory.total}
        </button>
      </div>

      {activeTab === 'bestiary' ? (
        <div className="settings-medals-grid" role="tabpanel" aria-label="Bestiary">
          {bestiary.entries.map((entry) => (
            <BestiaryTile key={entry.id} entry={entry} />
          ))}
        </div>
      ) : (
        <div className="settings-medals-grid" role="tabpanel" aria-label="Armory">
          {CODEX_ENTRIES.map((entry) => (
            <ArmoryTile
              key={entry.id}
              entry={entry}
              discovered={armorySeenSet.has(entry.id)}
              seenSet={armorySeenSet}
            />
          ))}
        </div>
      )}

      {onClose && (
        <div className="inventory-footer">
          <button className="button settings-back" onClick={onClose}>BACK</button>
        </div>
      )}
    </div>
  );
};
