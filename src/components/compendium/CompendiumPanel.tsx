import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useNotification } from '../../hooks/useNotification';
import { getBestiaryProgress } from '../../utils/bestiaryUtils';
import {
  claimBestiaryReward,
  getBestiaryRewardState,
  type BestiaryReward,
} from '../../utils/bestiaryRewardUtils';
import { getCodexIds, getCodexProgress } from '../../utils/codexUtils';
import { grantFreeReroll } from '../../utils/shopStorage';
import { CODEX_ENTRIES, getCodexEntry } from '../../data/codex';
import type { Character } from '../../types/Character';
import { ArmoryCard } from './ArmoryCard';
import { BestiaryCard } from './BestiaryCard';
import '../../styles/components/_compendium.scss';

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
    getBestiaryProgress(character)
      .entries.filter((entry) => entry.seen)
      .map((entry) => entry.id),
  );
  return { monsters, items: new Set(getCodexIds(character)) };
}

export const CompendiumPanel = ({ onClose }: CompendiumPanelProps) => {
  const { activeCharacter, addEssence } = useGame() as { activeCharacter: Character | null; addEssence?: (amount: number) => Promise<Character | null> };
  const { notify } = useNotification();
  const [activeTab, setActiveTab] = useState<CompendiumTab>('bestiary');
  const snapshotRef = useRef<CompendiumSnapshot | null>(null);
  const [claimVersion, setClaimVersion] = useState(0);

  const character = activeCharacter ?? null;
  const bestiary = useMemo(() => getBestiaryProgress(character ?? {}), [character]);
  const rewardState = useMemo(() => (character ? getBestiaryRewardState(character) : { claimedIds: [], claimable: [] as BestiaryReward[] }), [character, claimVersion]);
  const claimableByMonster = useMemo(() => {
    const map = new Map<string, BestiaryReward[]>();
    for (const reward of rewardState.claimable) {
      if (reward.type !== 'monster') continue;
      const list = map.get(reward.monsterId) ?? [];
      list.push(reward);
      map.set(reward.monsterId, list);
    }
    return map;
  }, [rewardState.claimable]);
  const globalClaimable = useMemo(
    () => rewardState.claimable.filter((reward): reward is Extract<BestiaryReward, { type: 'global' }> => reward.type === 'global'),
    [rewardState.claimable],
  );
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

  const handleClaimReward = useCallback(async (reward: BestiaryReward) => {
    if (!character) return;
    const claimed = claimBestiaryReward(character, reward.id);
    if (!claimed) return;
    if (reward.essence > 0) {
      if (addEssence) await addEssence(reward.essence);
      notify(`+${reward.essence} essence`, 'success', 2500);
    }
    if (reward.type === 'global' && reward.reroll > 0) {
      grantFreeReroll(character.id ?? character.seed, undefined, reward.reroll);
      notify(`+${reward.reroll} reroll shop`, 'success', 2500);
    }
    if (reward.type === 'monster' && reward.badge) {
      notify(`Badge ${reward.badge} débloqué !`, 'success', 2500);
    }
    setClaimVersion((value) => value + 1);
  }, [character, addEssence, notify]);

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
          {globalClaimable.length > 0 && (
            <div className="compendium-global-rewards">
              {globalClaimable.map((reward) => (
                <button
                  key={reward.id}
                  type="button"
                  className="compendium-reward-btn"
                  onClick={() => { void handleClaimReward(reward); }}
                >
                  {`Claim ${reward.milestone} species`}
                </button>
              ))}
            </div>
          )}
          {bestiary.entries.map((entry) => (
            <BestiaryCard
              key={entry.id}
              entry={entry}
              claimableRewards={claimableByMonster.get(entry.id) ?? []}
              claimedRewardIds={rewardState.claimedIds}
              onClaimReward={handleClaimReward}
            />
          ))}
        </div>
      ) : (
        <div className="settings-medals-grid" role="tabpanel" aria-label="Armory">
          {CODEX_ENTRIES.map((entry) => (
            <ArmoryCard
              key={entry.id}
              entry={entry}
              discovered={armorySeenSet.has(entry.id)}
              seenIds={armorySeenSet}
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
