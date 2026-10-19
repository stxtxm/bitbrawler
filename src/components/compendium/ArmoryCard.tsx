import { getCodexHint } from '../../utils/codexUtils';
import { getItemById } from '../../utils/equipmentUtils';
import type { CodexEntry } from '../../data/codex';
import { PixelItemIcon } from '../PixelItemIcon';

export interface ArmoryCardProps {
  entry: CodexEntry;
  discovered: boolean;
  seenIds?: ReadonlySet<string>;
}

export function ArmoryCard({ entry, discovered, seenIds }: ArmoryCardProps) {
  const item = getItemById(entry.id);
  const seen = seenIds ? new Set(seenIds) : new Set<string>();
  const hint = getCodexHint(entry.id, seen);
  const stateClass = discovered ? 'is-discovered' : 'is-unknown';

  return (
    <article
      className={`compendium-card compendium-card--item ${stateClass}`}
      aria-label={discovered ? entry.name : 'Undiscovered item'}
    >
      <div className="compendium-card__art">
        {item ? (
          <PixelItemIcon
            pixels={item.pixels}
            size={44}
            className={
              discovered
                ? 'compendium-icon'
                : 'compendium-icon compendium-icon--unknown'
            }
          />
        ) : (
          <span className="compendium-card__placeholder" aria-hidden="true">
            ?
          </span>
        )}
      </div>

      <h3 className="compendium-card__name">{discovered ? entry.name : '???'}</h3>

      {discovered ? (
        <p className={`compendium-card__meta shop-rarity-${entry.rarity}`}>
          {entry.rarity.toUpperCase()}
        </p>
      ) : (
        <p className="compendium-card__meta" data-testid="armory-hint">
          {hint}
        </p>
      )}
    </article>
  );
}
