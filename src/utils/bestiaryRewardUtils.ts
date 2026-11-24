import type { Character } from '../types/Character';
import { MONSTER_ASSETS } from '../data/monsterAssets';
import { getBestiaryProgress, mergeMonsterCounters } from './bestiaryUtils';
import {
  claimBestiaryRewardId,
  isBestiaryRewardClaimed,
  loadBestiaryRewardClaims,
} from './bestiaryRewardStorage';

export const DISCOVERY_ESSENCE_REWARD = 5;

export interface BestiaryKillMilestone {
  kills: number;
  essence: number;
  label: string;
  badge?: string;
}

export interface BestiaryGlobalMilestone {
  species: number;
  essence: number;
  reroll: number;
  label: string;
}

export type BestiaryReward =
  | {
      id: string;
      type: 'monster';
      monsterId: string;
      monsterName: string;
      milestone: number;
      essence: number;
      label: string;
      badge?: string;
    }
  | {
      id: string;
      type: 'global';
      milestone: number;
      essence: number;
      reroll: number;
      label: string;
    };

export interface BestiaryRewardState {
  claimedIds: string[];
  claimable: BestiaryReward[];
}

export const BESTIARY_KILL_MILESTONES: BestiaryKillMilestone[] = [
  { kills: 1, essence: DISCOVERY_ESSENCE_REWARD, label: 'Découverte' },
  { kills: 5, essence: 10, label: 'Fiche complète' },
  { kills: 25, essence: 0, label: 'Badge chasseur', badge: 'Hunter' },
];

export const BESTIARY_GLOBAL_MILESTONES: BestiaryGlobalMilestone[] = [
  { species: 10, essence: 20, reroll: 1, label: '10 espèces' },
  { species: 25, essence: 30, reroll: 1, label: '25 espèces' },
  { species: 50, essence: 40, reroll: 1, label: '50 espèces' },
  { species: 100, essence: 50, reroll: 1, label: '100 espèces' },
];

function characterKey(character: Character): string {
  return character.id ?? character.seed ?? 'unknown';
}

export function getBestiaryGlobalProgress(character: Pick<Character, 'monsterKills' | 'monsterEncounters'>) {
  return getBestiaryProgress(character);
}

function buildMonsterRewards(character: Character): BestiaryReward[] {
  const progress = getBestiaryProgress(character);
  const rewards: BestiaryReward[] = [];

  for (const entry of progress.entries) {
    for (const milestone of BESTIARY_KILL_MILESTONES) {
      const reached = milestone.kills === 1 ? entry.seen : entry.kills >= milestone.kills;
      if (!reached) continue;
      rewards.push({
        id: `monster:${entry.id}:${milestone.kills}`,
        type: 'monster',
        monsterId: entry.id,
        monsterName: entry.name,
        milestone: milestone.kills,
        essence: milestone.essence,
        label: milestone.label,
        badge: milestone.badge,
      });
    }
  }

  return rewards;
}

function buildGlobalRewards(character: Character): BestiaryReward[] {
  const progress = getBestiaryProgress(character);
  const rewards: BestiaryReward[] = [];
  const availableSpecies = MONSTER_ASSETS.length;

  for (const milestone of BESTIARY_GLOBAL_MILESTONES) {
    if (milestone.species > availableSpecies) continue;
    if (progress.seen < milestone.species) continue;
    rewards.push({
      id: `global:${milestone.species}`,
      type: 'global',
      milestone: milestone.species,
      essence: milestone.essence,
      reroll: milestone.reroll,
      label: milestone.label,
    });
  }

  return rewards;
}

export function getClaimableBestiaryRewards(character: Character): BestiaryReward[] {
  const key = characterKey(character);
  const claimed = new Set(loadBestiaryRewardClaims(key));
  return [...buildMonsterRewards(character), ...buildGlobalRewards(character)].filter(
    (reward) => !claimed.has(reward.id),
  );
}

export function getBestiaryRewardState(character: Character): BestiaryRewardState {
  const key = characterKey(character);
  return {
    claimedIds: loadBestiaryRewardClaims(key),
    claimable: getClaimableBestiaryRewards(character),
  };
}

export function claimBestiaryReward(character: Character, rewardId: string): boolean {
  return claimBestiaryRewardId(characterKey(character), rewardId);
}

export function isBestiaryRewardAlreadyClaimed(character: Character, rewardId: string): boolean {
  return isBestiaryRewardClaimed(characterKey(character), rewardId);
}

export function applyBestiaryReward(character: Character, reward: BestiaryReward): Character {
  const essence = Math.max(0, Math.floor(reward.essence));
  return {
    ...character,
    essence: (character.essence ?? 0) + essence,
    monsterKills: mergeMonsterCounters(character.monsterKills),
    monsterEncounters: mergeMonsterCounters(character.monsterEncounters),
  };
}
