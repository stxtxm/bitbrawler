import { Character } from '../types/Character'
import { applyEquipmentToCharacter } from './equipmentUtils'
import { COMBAT_BALANCE } from '../config/combatBalance'

export interface CombatStats {
  totalPower: number;
  offense: number;
  defense: number;
  speed: number;
  critChance: number;
  magicPower: number;
  focus: number;
}

export interface CombatSnapshot {
  attackerHp: number;
  defenderHp: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function getLevelMultiplier(level: number): number {
  const levelDelta = Math.max(0, level - 1);
  const bonus = Math.min(
    COMBAT_BALANCE.levelScaling.maxBonus,
    levelDelta * COMBAT_BALANCE.levelScaling.perLevel
  );
  return 1 + bonus;
}

function scaleStat(value: number): number {
  if (value <= COMBAT_BALANCE.statBaseline) return value;
  const delta = value - COMBAT_BALANCE.statBaseline;
  return COMBAT_BALANCE.statBaseline + Math.pow(delta, COMBAT_BALANCE.diminishingExponent);
}

function buildCombatStats(effectiveCharacter: Character): CombatStats {
  const levelMultiplier = getLevelMultiplier(effectiveCharacter.level);

  const effectiveStrength = scaleStat(effectiveCharacter.strength);
  const effectiveVitality = scaleStat(effectiveCharacter.vitality);
  const effectiveDexterity = scaleStat(effectiveCharacter.dexterity);
  const effectiveLuck = scaleStat(effectiveCharacter.luck);
  const effectiveIntelligence = scaleStat(effectiveCharacter.intelligence);
  const effectiveFocus = scaleStat(effectiveCharacter.focus);

  const offense = effectiveStrength * COMBAT_BALANCE.statWeights.offense * levelMultiplier;
  const defense = effectiveVitality * COMBAT_BALANCE.statWeights.defense * levelMultiplier;
  const speed = effectiveDexterity * COMBAT_BALANCE.statWeights.speed * levelMultiplier;
  const critChance = Math.min(
    COMBAT_BALANCE.statWeights.critCap,
    effectiveLuck * COMBAT_BALANCE.statWeights.critChance
  );
  const magicPower = effectiveIntelligence * COMBAT_BALANCE.statWeights.magicPower * levelMultiplier;
  const focus = effectiveFocus * COMBAT_BALANCE.statWeights.focus * levelMultiplier;

  const totalPower = (
    offense +
    defense +
    speed +
    magicPower +
    critChance +
    (focus * COMBAT_BALANCE.statWeights.totalPowerFocusWeight)
  );

  return {
    totalPower,
    offense,
    defense,
    speed,
    critChance,
    magicPower,
    focus
  };
}

export function calculateCombatStats(character: Character): CombatStats {
  const effectiveCharacter = applyEquipmentToCharacter(character);
  return buildCombatStats(effectiveCharacter);
}

export function getCombatBalance(stats: CombatStats): string {
  const { offense, defense, speed, magicPower, focus } = stats

  const spread = Math.max(offense, defense, speed, magicPower, focus) - Math.min(offense, defense, speed, magicPower, focus);
  if (spread <= 1.5) return "⚖️ Balanced";

  const max = Math.max(offense, defense, speed, magicPower, focus);

  if (max === offense) return "⚔️ Berserker";
  if (max === defense) return "🛡️ Tank";
  if (max === speed) return "⚡ Speedster";
  if (max === magicPower) return "🔮 Mage";
  if (max === focus) return "🎯 Sharpshooter";
  return "⚖️ Balanced";
}

export function simulateCombat(attacker: Character, defender: Character): {
  winner: 'attacker' | 'defender' | 'draw';
  rounds: number;
  details: string[];
  timeline: CombatSnapshot[];
} {
  const effectiveAttacker = applyEquipmentToCharacter(attacker)
  const effectiveDefender = applyEquipmentToCharacter(defender)
  const intruder = buildCombatStats(effectiveAttacker)
  const target = buildCombatStats(effectiveDefender)

  const details: string[] = []
  const timeline: CombatSnapshot[] = []
  let attackerHp = effectiveAttacker.hp
  let defenderHp = effectiveDefender.hp
  let rounds = 0

  const clampHp = (hp: number) => Math.max(0, Math.round(hp))
  const record = (detail: string) => {
    details.push(detail)
    timeline.push({
      attackerHp: clampHp(attackerHp),
      defenderHp: clampHp(defenderHp)
    })
  }

  record(`${attacker.name} vs ${defender.name}`)

  const resolveAttack = (
    actor: Character,
    actorStats: CombatStats,
    targetStats: CombatStats,
    actorHp: number,
    targetHp: number,
    round: number,
    isCounter: boolean
  ) => {
    const actorComeback = actorHp < (actor.maxHp * COMBAT_BALANCE.comeback.hpThresholdRatio)
      ? COMBAT_BALANCE.comeback.damageMultiplier
      : 1.0

    const speedDelta = actorStats.speed - targetStats.speed
    const focusDelta = actorStats.focus - targetStats.focus
    const baseHitChance = COMBAT_BALANCE.hitChance.base +
      (speedDelta * COMBAT_BALANCE.hitChance.speedWeight) +
      (focusDelta * COMBAT_BALANCE.hitChance.focusWeight)
    const finalHitChance = clamp(
      baseHitChance + (actorComeback > 1 ? COMBAT_BALANCE.comeback.hitBonus : 0),
      COMBAT_BALANCE.hitChance.min,
      COMBAT_BALANCE.hitChance.max
    )

    if (Math.random() * 100 < finalHitChance) {
      let damageMultiplier = 1
      let msg = ""

      if (Math.random() * 100 < actorStats.critChance) {
        damageMultiplier = COMBAT_BALANCE.damage.critMultiplier
        msg = " CRIT!"
      }

      const magicChance = Math.min(
        COMBAT_BALANCE.magic.maxChance,
        COMBAT_BALANCE.magic.baseChance +
        (actorStats.magicPower * COMBAT_BALANCE.magic.powerWeight) +
        (actorStats.focus * COMBAT_BALANCE.magic.focusWeight)
      )
      const isMagic = Math.random() * 100 < magicChance
      const magicSurge = isMagic ? Math.round(actorStats.magicPower * COMBAT_BALANCE.magic.damageWeight) : 0
      const focusStability = Math.min(
        COMBAT_BALANCE.focusVariance.maxStability,
        actorStats.focus * COMBAT_BALANCE.focusVariance.stabilityWeight
      )
      const varianceRange = COMBAT_BALANCE.focusVariance.baseRange - focusStability
      const varianceFactor = (1 - (varianceRange / 2)) + (Math.random() * varianceRange)
      const focusSurge = Math.random() * 100 < Math.min(
        COMBAT_BALANCE.focusSurge.maxChance,
        actorStats.focus * COMBAT_BALANCE.focusSurge.chanceWeight
      ) ? COMBAT_BALANCE.focusSurge.damageMultiplier : 1
      const baseDamage = (
        actorStats.offense * COMBAT_BALANCE.damage.offenseWeight * damageMultiplier
      ) - (
        targetStats.defense * COMBAT_BALANCE.damage.defenseWeight
      )
      const damage = Math.max(
        COMBAT_BALANCE.damage.min,
        Math.round((baseDamage + magicSurge) * varianceFactor * actorComeback * focusSurge)
      )
      targetHp -= damage

      if (isMagic) {
        const magicVerb = isCounter ? "counters with MAGIC SURGE!" : "uses MAGIC SURGE!"
        return {
          actorHp,
          targetHp,
          detail: `Round ${round}: ${actor.name} ${magicVerb} ${damage} DMG`
        }
      }

      const actionVerb = isCounter ? "counter" : "hit"
      return {
        actorHp,
        targetHp,
        detail: `Round ${round}: ${actor.name} ${actionVerb}${msg} ${damage} DMG`
      }
    }

    const missVerb = isCounter ? "missed counter!" : "missed!"
    return {
      actorHp,
      targetHp,
      detail: `Round ${round}: ${actor.name} ${missVerb}`
    }
  }

  while (attackerHp > 0 && defenderHp > 0 && rounds < COMBAT_BALANCE.roundLimit) {
    rounds++

    const initiativeChance = COMBAT_BALANCE.initiative.baseChance +
      ((intruder.speed - target.speed) * COMBAT_BALANCE.initiative.speedWeight)
    const attackerFirst = Math.random() < clamp(
      initiativeChance,
      COMBAT_BALANCE.initiative.minChance,
      COMBAT_BALANCE.initiative.maxChance
    )

    if (attackerFirst) {
      const attackerStrike = resolveAttack(attacker, intruder, target, attackerHp, defenderHp, rounds, false)
      attackerHp = attackerStrike.actorHp
      defenderHp = attackerStrike.targetHp
      record(attackerStrike.detail)

      if (defenderHp <= 0) break

      const defenderStrike = resolveAttack(defender, target, intruder, defenderHp, attackerHp, rounds, true)
      defenderHp = defenderStrike.actorHp
      attackerHp = defenderStrike.targetHp
      record(defenderStrike.detail)
    } else {
      const defenderStrike = resolveAttack(defender, target, intruder, defenderHp, attackerHp, rounds, false)
      defenderHp = defenderStrike.actorHp
      attackerHp = defenderStrike.targetHp
      record(defenderStrike.detail)

      if (attackerHp <= 0) break

      const attackerStrike = resolveAttack(attacker, intruder, target, attackerHp, defenderHp, rounds, true)
      attackerHp = attackerStrike.actorHp
      defenderHp = attackerStrike.targetHp
      record(attackerStrike.detail)
    }
  }

  let winner: 'attacker' | 'defender' | 'draw'
  if (attackerHp <= 0 && defenderHp <= 0) {
    winner = 'draw'
    record("Match nul !")
  } else if (attackerHp <= 0) {
    winner = 'defender'
    record(`${defender.name} gagne !`)
  } else if (defenderHp <= 0) {
    winner = 'attacker'
    record(`${attacker.name} gagne !`)
  } else {
    winner = 'draw'
    record("Limite de rounds atteinte !")
  }

  return {
    winner,
    rounds,
    details,
    timeline
  }
}
