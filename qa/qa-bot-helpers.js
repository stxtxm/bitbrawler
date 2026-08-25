import config from './qa-bot.config.js'

export const PERSISTENT_RESET_LEVEL_HEADROOM = 2

export function persistentNameForGeneration(baseName, generation) {
  if (generation === 0) return baseName
  // Game name limit is 10 chars (CharacterCreation input maxLength=10). The
  // base name is truncated to make room for the "-N" generation suffix.
  const suffix = `-${generation + 1}`
  const maxBaseLen = 10 - suffix.length
  const base = baseName.length <= maxBaseLen ? baseName : baseName.slice(0, maxBaseLen)
  return `${base}${suffix}`
}

export function shouldForcePersistentReset(
  currentLevel,
  maxLevel = config.persistentCharacterMaxLevel,
  headroom = PERSISTENT_RESET_LEVEL_HEADROOM,
) {
  if (typeof currentLevel !== 'number' || !Number.isFinite(currentLevel)) return false
  return currentLevel >= maxLevel - headroom
}

export function parseLevelFromText(text) {
  const match = text.match(/LVL\s*(\d+)/i)
  return match ? parseInt(match[1]) : null
}
