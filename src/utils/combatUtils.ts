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

export function calculateCombatStats(character: Character): CombatStats {
  // Balanced calculation based on 5-stat system
  // STR -> Offense
  // VIT -> Defense
  // DEX -> Speed/Precision
  // LUK -> Criticals
  // INT -> Magic / Special Power

  const offense = character.strength * 2;
  const defense = character.vitality * 2;
  const speed = character.dexterity * 2;
  const critChance = Math.min(30, character.luck * 2);
  const magicPower = character.intelligence * 2;

  // Total power for comparison
  const totalPower = (offense + defense + speed + magicPower + (character.luck * 2));

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
    targetChar: Character,
    actorStats: CombatStats,
    targetStats: CombatStats,
    actorHp: number,
    targetHp: number,
    round: number,
    isCounter: boolean
  ) => {
    const actorComeback = actorHp < (actor.hp * 0.35) ? 1.1 : 1.0

    // Hit chance formula (65-92% range)
    const baseHitChance = 76 + (actor.dexterity - targetChar.dexterity) * 1.2
    const finalHitChance = Math.max(65, Math.min(92, baseHitChance + (actorComeback > 1 ? 4 : 0)))

    if (Math.random() * 100 < finalHitChance) {
      let damageMultiplier = 1
      let msg = ""

      if (Math.random() * 100 < actorStats.critChance) {
        damageMultiplier = 1.5
        msg = " CRIT!"
      }

      const isMagic = Math.random() * 100 < (actor.intelligence * 1.2)
      const magicSurge = isMagic ? Math.round(actorStats.magicPower * 0.5) : 0
      const varianceFactor = 0.85 + Math.random() * 0.3
      const baseDamage = (actorStats.offense * 1.1 * damageMultiplier) - (targetStats.defense * 0.6)
      const damage = Math.max(4, Math.round((baseDamage + magicSurge) * varianceFactor * actorComeback))
      targetHp -= damage

      if (isMagic) {
        const magicVerb = isCounter ? "counters with MAGIC SURGE!" : "uses MAGIC SURGE!"
        return {
          actorHp,
          targetHp,
          detail: `Round ${round}: ${actor.name} ${magicVerb} ${damage} DMG${actorComeback > 1 ? " 🔥" : ""}`
        }
      }

      const actionVerb = isCounter ? "counter" : "hit"
      return {
        actorHp,
        targetHp,
        detail: `Round ${round}: ${actor.name} ${actionVerb}${msg} ${damage} DMG${actorComeback > 1 ? " 🔥" : ""}`
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

    const initiativeChance = 0.5 + ((intruder.speed - target.speed) * 0.005)
    const attackerFirst = Math.random() < Math.max(0.35, Math.min(0.65, initiativeChance))

    if (attackerFirst) {
      const attackerStrike = resolveAttack(attacker, defender, intruder, target, attackerHp, defenderHp, rounds, false)
      attackerHp = attackerStrike.actorHp
      defenderHp = attackerStrike.targetHp
      record(attackerStrike.detail)

      if (defenderHp <= 0) break

      const defenderStrike = resolveAttack(defender, attacker, target, intruder, defenderHp, attackerHp, rounds, true)
      defenderHp = defenderStrike.actorHp
      attackerHp = defenderStrike.targetHp
      record(defenderStrike.detail)
    } else {
      const defenderStrike = resolveAttack(defender, attacker, target, intruder, defenderHp, attackerHp, rounds, false)
      defenderHp = defenderStrike.actorHp
      attackerHp = defenderStrike.targetHp
      record(defenderStrike.detail)

      if (attackerHp <= 0) break

      const attackerStrike = resolveAttack(attacker, defender, intruder, target, attackerHp, defenderHp, rounds, true)
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
