import type { CSSProperties } from 'react';
import { MONSTER_ASSETS } from '../../data/monsterAssets';
import { ELEMENT_LABELS } from '../../types/Item';
import type { BestiaryReward } from '../../utils/bestiaryRewardUtils';
import type { BestiaryEntry } from '../../utils/bestiaryUtils';
import { PixelMonster } from '../PixelMonster';
import '../../styles/components/_medal-card.scss';

interface BestiaryCardProps {
  entry: BestiaryEntry;
  claimableRewards?: BestiaryReward[];
  claimedRewardIds?: string[];
  onClaimReward?: (reward: BestiaryReward) => void | Promise<void>;
}

function formatCounter(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function BestiaryCard({
  entry,
  claimableRewards = [],
  claimedRewardIds = [],
  onClaimReward,
}: BestiaryCardProps) {
  const monster = MONSTER_ASSETS.find((candidate) => candidate.id === entry.id);
  const ficheUnlocked = entry.kills >= 5;
  const stateClass = entry.seen ? 'medal-card--unlocked' : 'medal-card--locked';
  const spriteClass = entry.seen && ficheUnlocked
    ? 'bestiary-card__sprite'
    : 'bestiary-card__sprite bestiary-card__sprite--silhouette';
  const spriteStyle: CSSProperties | undefined = entry.seen
    ? (ficheUnlocked ? undefined : { filter: 'brightness(0) saturate(100%) sepia(1) hue-rotate(10deg) opacity(0.75)' })
    : { filter: 'brightness(0) opacity(0.45)' };

  const claimedSet = new Set(claimedRewardIds);
  const hunterClaimed = claimedSet.has(`monster:${entry.id}:25`);
  const discoveryClaimable = claimableRewards.find((reward) => reward.type === 'monster' && reward.milestone === 1);
  const kill5Claimable = claimableRewards.find((reward) => reward.type === 'monster' && reward.milestone === 5);
  const kill25Claimable = claimableRewards.find((reward) => reward.type === 'monster' && reward.milestone === 25);
  const showDiscoveryHint = entry.seen && !ficheUnlocked;

  return (
    <div className={`medal-card bestiary-card ${stateClass}`}>
      <div
        className={spriteClass}
        style={spriteStyle}
        aria-hidden={entry.seen ? undefined : true}
      >
        {monster ? <PixelMonster monsterId={monster.id} scale={4} /> : null}
      </div>

      <div className="bestiary-card__info">
        <h3 className="medal-card__name">{ficheUnlocked ? entry.name : '???'}</h3>
        {entry.seen ? (
          <>
            {ficheUnlocked ? (
              <>
                <p className="bestiary-card__element">{ELEMENT_LABELS[entry.element]}</p>
                <p className="medal-card__description">
                  {monster?.specialty ?? 'Unknown specialty'}
                </p>
              </>
            ) : (
              <p className="medal-card__description">Espèce découverte - fiche incomplète</p>
            )}
            <p className="bestiary-card__kills">
              {entry.kills > 0
                ? formatCounter(entry.kills, 'kill', 'kills')
                : formatCounter(entry.encounters, 'encounter', 'encounters')}
            </p>
            <div className="bestiary-card__milestones">
              <span className={`bestiary-milestone ${entry.seen ? 'is-reached' : ''}`}>x1</span>
              <span className={`bestiary-milestone ${entry.kills >= 5 ? 'is-reached' : ''}`}>x5</span>
              <span className={`bestiary-milestone ${entry.kills >= 25 ? 'is-reached' : ''}`}>x25</span>
            </div>
            {(hunterClaimed || entry.kills >= 25) && <p className="bestiary-card__badge">HUNTER</p>}
            <div className="bestiary-card__rewards">
              {discoveryClaimable && onClaimReward && (
                <button type="button" className="compendium-reward-btn" onClick={() => { void onClaimReward(discoveryClaimable); }}>
                  Claim discovery
                </button>
              )}
              {kill5Claimable && onClaimReward && (
                <button type="button" className="compendium-reward-btn" onClick={() => { void onClaimReward(kill5Claimable); }}>
                  Claim x5
                </button>
              )}
              {kill25Claimable && onClaimReward && (
                <button type="button" className="compendium-reward-btn" onClick={() => { void onClaimReward(kill25Claimable); }}>
                  Claim x25
                </button>
              )}
            </div>
            {showDiscoveryHint && <p className="bestiary-card__hint">5 kills pour compléter la fiche</p>}
          </>
        ) : (
          <p className="medal-card__description">Not yet encountered</p>
        )}
      </div>
    </div>
  );
}
