import { Character } from '../types/Character'
import { calculateCombatStats, getCombatBalance } from '../utils/combatUtils'
import { PixelCharacter } from './PixelCharacter';
import './CharacterCard.css'

interface CharacterCardProps {
  character: Character;
  onSelect?: () => void;
  selected?: boolean;
}

const CharacterCard = ({ character, onSelect, selected }: CharacterCardProps) => {
  const combatStats = calculateCombatStats(character)
  const balance = getCombatBalance(combatStats)

  return (
    <div
      className={`character-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="character-avatar">
        <PixelCharacter
          gender={character.gender}
          seed={character.seed}
          scale={8}
        />
        <div className="level-badge">LV. {character.level}</div>
      </div>

      <div className="character-info">
        <h3 className="character-name">{character.name}</h3>
        <div className="combat-balance">{balance}</div>

        <div className="character-stats">
          <div className="stat">
            <span className="stat-label">STR:</span>
            <span className="stat-value">{character.strength}</span>
          </div>
          <div className="stat">
            <span className="stat-label">VIT:</span>
            <span className="stat-value">{character.vitality}</span>
          </div>
          <div className="stat">
            <span className="stat-label">DEX:</span>
            <span className="stat-value">{character.dexterity}</span>
          </div>
          <div className="stat">
            <span className="stat-label">LUK:</span>
            <span className="stat-value">{character.luck}</span>
          </div>
          <div className="stat hp-full">
            <span className="stat-label">HP:</span>
            <span className="stat-value">{character.hp}/{character.maxHp}</span>
          </div>
        </div>

        <div className="power-indicator">
          <div className="power-bar">
            <div
              className="power-fill"
              style={{ width: `${Math.min(100, (combatStats.totalPower / 120) * 100)}%` }}
            ></div>
          </div>
          <span className="power-text">POWER: {Math.round(combatStats.totalPower)}</span>
        </div>

        <div className="character-record">
          <span className="wins">WINS: {character.wins}</span>
          <span className="losses">LOSS: {character.losses}</span>
        </div>
      </div>
    </div>
  )
}

export default CharacterCard
