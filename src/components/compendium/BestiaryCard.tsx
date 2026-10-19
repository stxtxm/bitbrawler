import type { CSSProperties } from 'react';
import { MONSTER_ASSETS } from '../../data/monsterAssets';
import { ELEMENT_LABELS } from '../../types/Item';
import type { BestiaryEntry } from '../../utils/bestiaryUtils';
import { PixelMonster } from '../PixelMonster';
import '../../styles/components/_medal-card.scss';

interface BestiaryCardProps {
  entry: BestiaryEntry;
}

function formatKills(kills: number): string {
  return `${kills} ${kills === 1 ? 'kill' : 'kills'}`;
}

export function BestiaryCard({ entry }: BestiaryCardProps) {
  const monster = MONSTER_ASSETS.find((candidate) => candidate.id === entry.id);
  const stateClass = entry.seen ? 'medal-card--unlocked' : 'medal-card--locked';
  const spriteClass = entry.seen
    ? 'bestiary-card__sprite'
    : 'bestiary-card__sprite bestiary-card__sprite--silhouette';
  const spriteStyle: CSSProperties | undefined = entry.seen
    ? undefined
    : { filter: 'brightness(0) opacity(0.45)' };

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
        <h3 className="medal-card__name">{entry.seen ? entry.name : '???'}</h3>
        {entry.seen ? (
          <>
            <p className="bestiary-card__element">{ELEMENT_LABELS[entry.element]}</p>
            <p className="medal-card__description">
              {monster?.specialty ?? 'Unknown specialty'}
            </p>
            <p className="bestiary-card__kills">{formatKills(entry.kills)}</p>
          </>
        ) : (
          <p className="medal-card__description">Not yet encountered</p>
        )}
      </div>
    </div>
  );
}
