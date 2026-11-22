import type { Character } from '../types/Character';
import { simulateBossAttack, type BossProgress } from './bossUtils';

export interface BossOutcomeEstimate {
  /** Chance de tuer le boss en UNE attaque (0-100). */
  winChance: number;
  /** Chance de ne pas le tuer sur cette attaque (0-100). */
  lossChance: number;
  /** Dégâts moyens infligés au pool de HP du boss par attaque. */
  averageDamage: number;
  minDamage: number;
  maxDamage: number;
  /** Nombre d'attaques estimé pour vider le pool restant. */
  attacksToKill: number | null;
}

const DEFAULT_SAMPLES = 60;

const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * Estime l'issue d'une attaque contre le boss en rejouant le vrai moteur de
 * combat (`simulateBossAttack`). Le boss a un pool de HP persistant : la
 * « victoire » mesurée ici est donc le coup de grâce, pas un simple échange.
 */
export function estimateBossOutcome(
  player: Character,
  progress: BossProgress,
  samples = DEFAULT_SAMPLES,
): BossOutcomeEstimate {
  if (!progress || progress.bossHp <= 0) {
    return {
      winChance: 100,
      lossChance: 0,
      averageDamage: 0,
      minDamage: 0,
      maxDamage: 0,
      attacksToKill: 0,
    };
  }

  const safeSamples = Math.max(1, Math.floor(samples));
  let wins = 0;
  let totalDamage = 0;
  let minDamage = Number.POSITIVE_INFINITY;
  let maxDamage = 0;

  for (let i = 0; i < safeSamples; i += 1) {
    const outcome = simulateBossAttack(player, progress);
    if (outcome.won) wins += 1;
    totalDamage += outcome.damageDealt;
    minDamage = Math.min(minDamage, outcome.damageDealt);
    maxDamage = Math.max(maxDamage, outcome.damageDealt);
  }

  const winChance = round1((wins / safeSamples) * 100);
  const averageDamage = totalDamage / safeSamples;

  return {
    winChance,
    lossChance: round1(100 - winChance),
    averageDamage: Math.round(averageDamage),
    minDamage: Number.isFinite(minDamage) ? Math.round(minDamage) : 0,
    maxDamage: Math.round(maxDamage),
    attacksToKill: averageDamage > 0
      ? Math.max(1, Math.ceil(progress.bossHp / averageDamage))
      : null,
  };
}
