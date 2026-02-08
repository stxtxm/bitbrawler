import { Character } from '../types/Character'
import { applyEquipmentToCharacter } from './equipmentUtils'

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

const STAT_BASELINE = 10;

function scaleStat(value: number): number {
  if (value <= STAT_BASELINE) return value;
  const delta = value - STAT_BASELINE;
  return STAT_BASELINE + Math.pow(delta, 0.85);
}

export function calculateCombatStats(character: Character): CombatStats {
  const effectiveCharacter = applyEquipmentToCharacter(character);
  // Balanced calculation based on 5-stat system
  // STR -> Offense
  // VIT -> Defense
  // DEX -> Speed/Precision
  // LUK -> Criticals
  // INT -> Magic / Special Power
  // FOC -> Focus / Accuracy Control

  const effectiveStrength = scaleStat(effectiveCharacter.strength);
  const effectiveVitality = scaleStat(effectiveCharacter.vitality);
  const effectiveDexterity = scaleStat(effectiveCharacter.dexterity);
  const effectiveLuck = scaleStat(effectiveCharacter.luck);
  const effectiveIntelligence = scaleStat(effectiveCharacter.intelligence);
  const effectiveFocus = scaleStat(effectiveCharacter.focus);

  const offense = effectiveStrength * 1.85;
  const defense = effectiveVitality * 2.0;
  const speed = effectiveDexterity * 1.6;
  const critChance = Math.min(28, effectiveLuck * 1.35);
  const magicPower = effectiveIntelligence * 1.6;
  const focus = effectiveFocus * 1.35;

  // Total power for comparison
  const totalPower = (offense + defense + speed + magicPower + critChance + (focus * 0.6));

  return {
    totalPower,
    offense,
    defense,
    speed,
    critChance,
    magicPower,
    focus
  }
}

export function getCombatBalance(stats: CombatStats): string {
  const { offense, defense, speed, magicPower, focus } = stats

  if (offense === defense && defense === speed && speed === magicPower && speed === focus) return "⚖️ Balanced";

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
  const intruder = calculateCombatStats(attacker)
  const target = calculateCombatStats(defender)

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
    const actorComeback = actorHp < (actor.hp * 0.35) ? 1.1 : 1.0

    // Hit chance formula (62-90% range), weighted by speed differential
    const speedDelta = actorStats.speed - targetStats.speed
    const focusDelta = actorStats.focus - targetStats.focus
    const baseHitChance = 72 + (speedDelta * 0.4) + (focusDelta * 0.25)
    const finalHitChance = Math.max(60, Math.min(92, baseHitChance + (actorComeback > 1 ? 4 : 0)))

    if (Math.random() * 100 < finalHitChance) {
      let damageMultiplier = 1
      let msg = ""

      if (Math.random() * 100 < actorStats.critChance) {
        damageMultiplier = 1.45
        msg = " CRIT!"
      }

      const magicChance = Math.min(30, 5 + (actorStats.magicPower * 0.32) + (actorStats.focus * 0.08))
      const isMagic = Math.random() * 100 < magicChance
      const magicSurge = isMagic ? Math.round(actorStats.magicPower * 0.55) : 0
      const focusStability = Math.min(0.08, actorStats.focus * 0.002)
      const varianceRange = 0.2 - focusStability
      const varianceFactor = (1 - (varianceRange / 2)) + (Math.random() * varianceRange)
      const focusSurge = Math.random() * 100 < Math.min(8, actorStats.focus * 0.22) ? 1.08 : 1
      const baseDamage = (actorStats.offense * 1.18 * damageMultiplier) - (targetStats.defense * 0.55)
      const damage = Math.max(4, Math.round((baseDamage + magicSurge) * varianceFactor * actorComeback * focusSurge))
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

  while (attackerHp > 0 && defenderHp > 0 && rounds < 50) {
    rounds++

    const initiativeChance = 0.5 + ((intruder.speed - target.speed) * 0.004)
    const attackerFirst = Math.random() < Math.max(0.4, Math.min(0.6, initiativeChance))

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
