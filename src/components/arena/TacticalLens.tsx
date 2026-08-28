import { memo } from 'react';
import { PixelCharacter } from '../PixelCharacter';
import { AffinityBadge } from '../AffinityBadge';
import { ARCHETYPE_LABELS } from '../../utils/affinityUtils';
import { ELEMENT_LABELS } from '../../types/Item';
import type { TacticalHint } from '../../utils/tacticalLens';
import { Character } from '../../types/Character';

interface TacticalLensProps {
  opponent: Character;
  hint: TacticalHint;
  onOpenInventory: (element?: string) => void;
}

export const TacticalLens = memo(function TacticalLens({ opponent, hint, onOpenInventory }: TacticalLensProps) {
  return (
    <div className="tactical-lens" data-testid="tactical-lens">
      <div className="tactical-lens-label">TACTICAL LENS</div>
      <div className="tactical-lens-card">
        <div className="tactical-lens-avatar">
          <PixelCharacter seed={opponent.seed} gender={opponent.gender} appearance={opponent.appearance} scale={6} />
        </div>
        <div className="tactical-lens-info">
          <div className="tactical-lens-archetype" data-testid="tactical-archetype">
            {hint.defenderArchetype.toUpperCase()} — faible à {ELEMENT_LABELS[hint.defenderWeakness].toUpperCase()}
          </div>
          <div className="tactical-lens-badges">
            <span className="tactical-lens-weakness" data-testid="tactical-weakness">
              <AffinityBadge element={hint.defenderWeakness} size={12} /> {ELEMENT_LABELS[hint.defenderWeakness]}
            </span>
            {hint.defenderWeaponElement && (
              <span className="tactical-lens-opponent-weapon" data-testid="tactical-opponent-weapon">
                <AffinityBadge element={hint.defenderWeaponElement} size={10} /> {opponent.name}
              </span>
            )}
            {hint.playerWeaponElement && (
              <span className="tactical-lens-player-weapon" data-testid="tactical-player-weapon">
                Ta arme: <AffinityBadge element={hint.playerWeaponElement} size={10} /> {ELEMENT_LABELS[hint.playerWeaponElement]}
              </span>
            )}
            <span className="tactical-lens-archetype-label">{ARCHETYPE_LABELS[hint.defenderArchetype]}</span>
          </div>
        </div>
      </div>
      <div className="tactical-lens-hint" data-testid="tactical-hint">
        {hint.hintText}
      </div>
      <button
        className="button tactical-lens-switch-btn"
        data-testid="tactical-switch-btn"
        onClick={() => onOpenInventory(hint.defenderWeakness)}
        aria-label="Changer d'équipement"
      >
        Changer d&apos;équipement
      </button>
    </div>
  );
});
