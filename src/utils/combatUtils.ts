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

    // Comeback Spirit: Slight boost when HP is low (< 40%)
    const attackerComeback = attackerHp < (attacker.hp * 0.4) ? 1.15 : 1.0;
    const defenderComeback = defenderHp < (defender.hp * 0.4) ? 1.15 : 1.0;

    // Attacker turn
    // Hit chance formula (70-95% range)
    const attackerHitChance = 80 + (attacker.dexterity - defender.dexterity) * 1.5;
    const finalAttackerHitChance = Math.max(70, Math.min(95, attackerHitChance + (attackerComeback > 1 ? 5 : 0)));

    if (Math.random() * 100 < finalAttackerHitChance) {
      let damageMultiplier = 1;
      let msg = "";

      // Luck Crit
      if (Math.random() * 100 < intruder.critChance) {
        damageMultiplier = 1.6; // Increased from 1.5 to 1.6
        msg = " CRIT!";
      }

      // Intelligence Surge (Magic Damage)
      if (Math.random() * 100 < (attacker.intelligence * 1.5)) {
        const magicSurge = Math.round(intruder.magicPower * 0.6);
        // Increased damage variance to ±20% for more suspense
        const varianceFactor = 0.8 + Math.random() * 0.4;
        const baseDamage = (intruder.offense * 1.2 * damageMultiplier) - (target.defense * 0.5);
        const damage = Math.max(5, Math.round((baseDamage + magicSurge) * varianceFactor * attackerComeback));
        defenderHp -= damage;
        details.push(`Round ${rounds}: ${attacker.name} uses MAGIC SURGE! ${damage} DMG${attackerComeback > 1 ? " 🔥" : ""}`);
      } else {
        // Increased damage variance to ±20%
        const varianceFactor = 0.8 + Math.random() * 0.4;
        const baseDamage = (intruder.offense * 1.2 * damageMultiplier) - (target.defense * 0.5);
        const damage = Math.max(5, Math.round(baseDamage * varianceFactor * attackerComeback));
        defenderHp -= damage;
        details.push(`Round ${rounds}: ${attacker.name} hit${msg} ${damage} DMG${attackerComeback > 1 ? " 🔥" : ""}`);
      }
    } else {
      details.push(`Round ${rounds}: ${attacker.name} missed!`);
    }

    if (defenderHp <= 0) break;

    // Defender turn
    const defenderHitChance = 80 + (defender.dexterity - attacker.dexterity) * 1.5;
    const finalDefenderHitChance = Math.max(70, Math.min(95, defenderHitChance + (defenderComeback > 1 ? 5 : 0)));

    if (Math.random() * 100 < finalDefenderHitChance) {
      let damageMultiplier = 1;
      let msg = "";

      if (Math.random() * 100 < target.critChance) {
        damageMultiplier = 1.6;
        msg = " CRIT!";
      }

      // Defender Magic Surge
      if (Math.random() * 100 < (defender.intelligence * 1.5)) {
        const magicSurge = Math.round(target.magicPower * 0.6);
        // Increased damage variance to ±20%
        const varianceFactor = 0.8 + Math.random() * 0.4;
        const baseDamage = (target.offense * 1.2 * damageMultiplier) - (intruder.defense * 0.5);
        const counterDamage = Math.max(5, Math.round((baseDamage + magicSurge) * varianceFactor * defenderComeback));
        attackerHp -= counterDamage;
        details.push(`Round ${rounds}: ${defender.name} counters with MAGIC SURGE! ${counterDamage} DMG${defenderComeback > 1 ? " 🔥" : ""}`);
      } else {
        // Increased damage variance to ±20%
        const varianceFactor = 0.8 + Math.random() * 0.4;
        const baseDamage = (target.offense * 1.2 * damageMultiplier) - (intruder.defense * 0.5);
        const counterDamage = Math.max(5, Math.round(baseDamage * varianceFactor * defenderComeback));
        attackerHp -= counterDamage;
        details.push(`Round ${rounds}: ${defender.name} counter${msg} ${counterDamage} DMG${defenderComeback > 1 ? " 🔥" : ""}`);
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
