import { Character } from '../types/Character'

export interface CombatStats {
  totalPower: number;
  offense: number;
  defense: number;
  speed: number;
  critChance: number;
  magicPower: number;
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
} {
  const intruder = calculateCombatStats(attacker)
  const target = calculateCombatStats(defender)

  const details: string[] = []
  let attackerHp = attacker.hp
  let defenderHp = defender.hp
  let rounds = 0

  details.push(`${attacker.name} vs ${defender.name}`)

  while (attackerHp > 0 && defenderHp > 0 && rounds < 50) {
    rounds++

    // Attacker turn
    // More balanced hit chance formula (70-95% range instead of 65-98%)
    const attackerHitChance = 80 + (attacker.dexterity - defender.dexterity) * 1.5;
    if (Math.random() * 100 < Math.max(70, Math.min(95, attackerHitChance))) {
      let damageMultiplier = 1;
      let msg = "";

      // Luck Crit (slightly increased chance)
      if (Math.random() * 100 < intruder.critChance) {
        damageMultiplier = 1.5; // Increased from 1.4 to 1.5
        msg = " CRIT!";
      }

      // Intelligence Surge (Magic Damage)
      if (Math.random() * 100 < (attacker.intelligence * 1.5)) {
        const magicSurge = Math.round(intruder.magicPower * 0.5);
        // Add damage variance ±15%
        const varianceFactor = 0.85 + Math.random() * 0.3;
        const baseDamage = (intruder.offense * 1.2 * damageMultiplier) - (target.defense * 0.5);
        const damage = Math.max(5, Math.round((baseDamage + magicSurge) * varianceFactor));
        defenderHp -= damage;
        details.push(`Round ${rounds}: ${attacker.name} uses MAGIC SURGE! ${damage} DMG`);
      } else {
        // Add damage variance ±15%
        const varianceFactor = 0.85 + Math.random() * 0.3;
        const baseDamage = (intruder.offense * 1.2 * damageMultiplier) - (target.defense * 0.5);
        const damage = Math.max(5, Math.round(baseDamage * varianceFactor));
        defenderHp -= damage;
        details.push(`Round ${rounds}: ${attacker.name} hit${msg} ${damage} DMG`);
      }
    } else {
      details.push(`Round ${rounds}: ${attacker.name} missed!`);
    }

    if (defenderHp <= 0) break;

    // Defender turn
    const defenderHitChance = 80 + (defender.dexterity - attacker.dexterity) * 1.5;
    if (Math.random() * 100 < Math.max(70, Math.min(95, defenderHitChance))) {
      let damageMultiplier = 1;
      let msg = "";

      if (Math.random() * 100 < target.critChance) {
        damageMultiplier = 1.5;
        msg = " CRIT!";
      }

      // Defender Magic Surge
      if (Math.random() * 100 < (defender.intelligence * 1.5)) {
        const magicSurge = Math.round(target.magicPower * 0.5);
        // Add damage variance ±15%
        const varianceFactor = 0.85 + Math.random() * 0.3;
        const baseDamage = (target.offense * 1.2 * damageMultiplier) - (intruder.defense * 0.5);
        const counterDamage = Math.max(5, Math.round((baseDamage + magicSurge) * varianceFactor));
        attackerHp -= counterDamage;
        details.push(`Round ${rounds}: ${defender.name} counters with MAGIC SURGE! ${counterDamage} DMG`);
      } else {
        // Add damage variance ±15%
        const varianceFactor = 0.85 + Math.random() * 0.3;
        const baseDamage = (target.offense * 1.2 * damageMultiplier) - (intruder.defense * 0.5);
        const counterDamage = Math.max(5, Math.round(baseDamage * varianceFactor));
        attackerHp -= counterDamage;
        details.push(`Round ${rounds}: ${defender.name} counter${msg} ${counterDamage} DMG`);
      }
    } else {
      details.push(`Round ${rounds}: ${defender.name} missed counter!`);
    }
  }

  let winner: 'attacker' | 'defender' | 'draw'
  if (attackerHp <= 0 && defenderHp <= 0) {
    winner = 'draw'
    details.push("Match nul !")
  } else if (attackerHp <= 0) {
    winner = 'defender'
    details.push(`${defender.name} gagne !`)
  } else if (defenderHp <= 0) {
    winner = 'attacker'
    details.push(`${attacker.name} gagne !`)
  } else {
    winner = 'draw'
    details.push("Limite de rounds atteinte !")
  }

  return {
    winner,
    rounds,
    details
  }
}
