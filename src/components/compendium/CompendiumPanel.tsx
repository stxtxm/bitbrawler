import { useMemo, useState } from 'react';
import type { Character } from '../../types/Character';
import {
  getArmoryProgress,
  getBestiaryProgress,
  getCompendiumProgress,
} from '../../utils/compendiumUtils';
import type { CompendiumTab } from '../../data/compendium';
import { PixelMonster } from '../PixelMonster';
import { PixelItemIcon } from '../PixelItemIcon';

interface CompendiumPanelProps {
  character: Character | null;
}

function formatLevelRange(minLevel?: number, maxLevel?: number): string {
  if (minLevel === undefined && maxLevel === undefined) return 'Any level';
  if (minLevel !== undefined && maxLevel !== undefined) return `Lv ${minLevel}-${maxLevel}`;
  if (minLevel !== undefined) return `Lv ${minLevel}+`;
  return `Lv up to ${maxLevel}`;
}

export function CompendiumPanel({ character }: CompendiumPanelProps) {
  const [activeTab, setActiveTab] = useState<CompendiumTab>('bestiary');

  const bestiary = useMemo(() => getBestiaryProgress(character), [character]);
  const armory = useMemo(() => getArmoryProgress(character), [character]);
  const progress = useMemo(() => getCompendiumProgress(character), [character]);

  if (!character) {
    return (
      <div className="compendium-empty">
        <p>NO CHARACTER FOUND</p>
        <p className="compendium-empty__hint">Create a fighter to start the collection.</p>
      </div>
    );
  }

  const bestiaryDiscovered = bestiary.filter((entry) => entry.encountered).length;
  const armoryDiscovered = armory.filter((entry) => entry.seen).length;

  return (
    <div className="compendium-panel">
      <div className="compendium-overview">
        <div className="compendium-overview__row">
          <span className="compendium-overview__label">COLLECTION</span>
          <span className="compendium-overview__value">
            {progress.discovered} / {progress.total} · {progress.completionPct}%
          </span>
        </div>
        <div className="compendium-progress-bar">
          <div
            className="compendium-progress-bar__fill"
            style={{ width: `${progress.completionPct}%` }}
            role="progressbar"
            aria-valuenow={progress.discovered}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-label="Compendium completion"
          />
        </div>
      </div>

      <div className="compendium-tabs" role="tablist" aria-label="Compendium sections">
        <button
          className={`compendium-tab ${activeTab === 'bestiary' ? 'active' : ''}`}
          onClick={() => setActiveTab('bestiary')}
          role="tab"
          aria-selected={activeTab === 'bestiary'}
        >
          Bestiary {bestiaryDiscovered}/{bestiary.length}
        </button>
        <button
          className={`compendium-tab ${activeTab === 'armory' ? 'active' : ''}`}
          onClick={() => setActiveTab('armory')}
          role="tab"
          aria-selected={activeTab === 'armory'}
        >
          Armory {armoryDiscovered}/{armory.length}
        </button>
      </div>

      {activeTab === 'bestiary' ? (
        <div className="compendium-grid" role="tabpanel" aria-label="Bestiary">
          {bestiary.map(({ entry, encountered, kills }) => (
            <article
              key={entry.id}
              className={`compendium-card ${encountered ? 'is-discovered' : 'is-unknown'}`}
              aria-label={encountered ? entry.name : 'Undiscovered monster'}
            >
              <div className="compendium-card__art" aria-hidden={!encountered}>
                <PixelMonster monsterId={entry.id} scale={3} />
              </div>
              <h3 className="compendium-card__name">{encountered ? entry.name : '???'}</h3>
              {encountered ? (
                <>
                  <p className="compendium-card__meta">
                    {entry.biomeLabel} · {formatLevelRange(entry.minLevel, entry.maxLevel)}
                  </p>
                  <p className="compendium-card__meta compendium-card__meta--accent">
                    Kills: {kills}
                  </p>
                </>
              ) : (
                <p className="compendium-card__meta">Undiscovered</p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="compendium-grid" role="tabpanel" aria-label="Armory">
          {armory.map(({ entry, seen, owned }) => (
            <article
              key={entry.id}
              className={`compendium-card compendium-card--item ${seen ? 'is-discovered' : 'is-unknown'}`}
              aria-label={seen ? entry.name : 'Undiscovered item'}
            >
              <div className="compendium-card__art" aria-hidden={!seen}>
                <PixelItemIcon
                  pixels={entry.pixels}
                  size={44}
                  className={seen ? 'compendium-icon' : 'compendium-icon compendium-icon--unknown'}
                />
              </div>
              <h3 className="compendium-card__name">{seen ? entry.name : '???'}</h3>
              {seen ? (
                <p className="compendium-card__meta">
                  {entry.rarity.toUpperCase()}
                  {entry.element ? ` · ${entry.element.toUpperCase()}` : ''}
                </p>
              ) : (
                <p className="compendium-card__meta">Undiscovered</p>
              )}
              {owned && <span className="compendium-card__owned">OWNED</span>}
            </article>
          ))}
        </div>
      )}

      <div className="compendium-footer">
        {activeTab === 'bestiary'
          ? `${bestiaryDiscovered} / ${bestiary.length} monsters encountered`
          : `${armoryDiscovered} / ${armory.length} items discovered`}
      </div>
    </div>
  );
}
