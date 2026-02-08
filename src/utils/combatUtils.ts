import { Character } from '../types/Character'

export interface CombatStats {
  totalPower: number;
  offense: number;
  defense: number;
  speed: number;
  critChance: number;
  magicPower: number;
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
  // Balanced calculation based on 5-stat system
  // STR -> Offense
  // VIT -> Defense
  // DEX -> Speed/Precision
  // LUK -> Criticals
  // INT -> Magic / Special Power

  const effectiveStrength = scaleStat(character.strength);
  const effectiveVitality = scaleStat(character.vitality);
  const effectiveDexterity = scaleStat(character.dexterity);
  const effectiveLuck = scaleStat(character.luck);
  const effectiveIntelligence = scaleStat(character.intelligence);

  const offense = effectiveStrength * 1.9;
  const defense = effectiveVitality * 2.1;
  const speed = effectiveDexterity * 1.7;
  const critChance = Math.min(28, effectiveLuck * 1.4);
  const magicPower = effectiveIntelligence * 1.7;

  // Total power for comparison
  const totalPower = (offense + defense + speed + magicPower + critChance);

  return {
    totalPower,
    offense,
    defense,
    speed,
    critChance,
    magicPower
  }
}

export function getCombatBalance(stats: CombatStats): string {
  const { offense, defense, speed, magicPower } = stats

  if (offense === defense && defense === speed && speed === magicPower) return "⚖️ Balanced";

  const max = Math.max(offense, defense, speed, magicPower);

  if (max === offense) return "⚔️ Berserker";
  if (max === defense) return "🛡️ Tank";
  if (max === speed) return "⚡ Speedster";
  if (max === magicPower) return "🔮 Mage";
  return "⚖️ Balanced";
}

export function simulateCombat(attacker: Character, defender: Character): {
  winner: 'attacker' | 'defender' | 'draw';
  rounds: number;
  details: string[];
  timeline: CombatSnapshot[];
} {
  const intruder = calculateCombatStats(attacker)
  const target = calculateCombatStats(defender)

  const details: string[] = []
  const timeline: CombatSnapshot[] = []
  let attackerHp = attacker.hp
  let defenderHp = defender.hp
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
    const baseHitChance = 74 + (speedDelta * 0.45)
    const finalHitChance = Math.max(62, Math.min(90, baseHitChance + (actorComeback > 1 ? 4 : 0)))

    if (Math.random() * 100 < finalHitChance) {
      let damageMultiplier = 1
      let msg = ""

      if (Math.random() * 100 < actorStats.critChance) {
        damageMultiplier = 1.45
        msg = " CRIT!"
      }

      const magicChance = Math.min(30, 5 + (actorStats.magicPower * 0.35))
      const isMagic = Math.random() * 100 < magicChance
      const magicSurge = isMagic ? Math.round(actorStats.magicPower * 0.55) : 0
      const varianceFactor = 0.9 + Math.random() * 0.2
      const baseDamage = (actorStats.offense * 1.2 * damageMultiplier) - (targetStats.defense * 0.55)
      const damage = Math.max(4, Math.round((baseDamage + magicSurge) * varianceFactor * actorComeback))
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
