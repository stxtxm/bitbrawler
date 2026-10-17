import config from '../../qa/qa-bot.config.js'

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

export const COMBAT_SPEED_STORAGE_KEY = 'bitbrawler_combat_speed'
export const COMBAT_SPEED_OPTIONS = [1, 2]
export const COMBAT_SPEED_TOGGLE_SELECTOR = '.combat-speed-toggle'
export const COMBAT_SPEED_SETTINGS_SELECTOR = 'button[aria-label="Combat speed"]'

export function isCombatSpeed(value) {
  return typeof value === 'number' && COMBAT_SPEED_OPTIONS.includes(value)
}

export function parseCombatSpeed(value) {
  return isCombatSpeed(value) ? value : null
}

export function parseCombatSpeedText(text) {
  if (typeof text !== 'string' || !text) return null
  const match = text.match(/x\s*([12])/i)
  if (!match) return null
  const num = parseInt(match[1], 10)
  return isCombatSpeed(num) ? num : null
}

export function getCombatSpeedFromStorageRaw(raw) {
  if (raw === null || raw === undefined || raw === '') return 1
  try {
    const parsed = JSON.parse(raw)
    if (isCombatSpeed(parsed)) return parsed
  } catch {
  }
  const asNum = parseInt(String(raw), 10)
  if (isCombatSpeed(asNum)) return asNum
  return 1
}

export function nextCombatSpeed(current) {
  if (current === 1) return 2
  if (current === 2) return 1
  return 1
}

export const SITE_DOWN_ERROR_PREFIX = 'SITE_DOWN'

// Pages d'erreur d'hebergement : on veut les detecter vite, sinon le bot
// "collecte" des stats d'une page 402/500 et les remonte comme si c'etait
// un run de jeu valide.
const ERROR_PAGE_MARKERS = [
  '402',
  'payment required',
  'deployment protection',
  'error code: 1101',
  'deployment_disabled',
]

const GAME_CONTENT_MARKERS = ['battle energy', 'auto mode', 'enter arena', 'login', 'create', 'arena']

export function isSiteDownStatus(status) {
  return typeof status === 'number' && Number.isFinite(status) && status >= 400
}

export function looksLikeErrorPage(bodyText) {
  if (typeof bodyText !== 'string' || bodyText.length === 0) return false
  const lower = bodyText.toLowerCase()
  return ERROR_PAGE_MARKERS.some(marker => lower.includes(marker))
}

export function hasGameContent(bodyText) {
  if (typeof bodyText !== 'string' || bodyText.length === 0) return false
  const lower = bodyText.toLowerCase()
  return GAME_CONTENT_MARKERS.some(marker => lower.includes(marker))
}

export function buildSiteDownMessage(status, url) {
  return `${SITE_DOWN_ERROR_PREFIX}: HTTP ${status} on ${url}`
}

export function buildSiteDownBodyMessage(url) {
  return `${SITE_DOWN_ERROR_PREFIX}: error page served on ${url} (no game selector)`
}

export function throwIfSiteDownResponse(response, url) {
  const status = typeof response?.status === 'function' ? response.status() : response?.status
  if (isSiteDownStatus(status)) {
    throw new Error(buildSiteDownMessage(status, url))
  }
}

export function throwIfErrorPageBody(bodyText, url, hasGameSelector) {
  const gamePresent = typeof hasGameSelector === 'boolean' ? hasGameSelector : hasGameContent(bodyText)
  if (looksLikeErrorPage(bodyText) && !gamePresent) {
    throw new Error(buildSiteDownBodyMessage(url))
  }
}

export function classifyRunError(message) {
  const text = String(message ?? '')
  if (text.includes(SITE_DOWN_ERROR_PREFIX)) return 'site_down'
  if (text.includes('locator.waitFor') || text.includes('waitFor')) return 'flaky_locator'
  return 'other'
}

export function determineNextFightType(pvpSinceLastPve, pveRatio, pveOnly, characterLevel = null, pvpUnlockLevel = 1) {
  if (characterLevel !== null && characterLevel < pvpUnlockLevel) {
    return { type: 'pve', pvpSinceLastPve: 0 }
  }
  if (pveOnly) {
    return { type: 'pve', pvpSinceLastPve: 0 }
  }
  if (pveRatio <= 0) {
    return { type: 'pvp', pvpSinceLastPve: pvpSinceLastPve + 1 }
  }
  const pvpPerPve = Math.max(1, Math.round(1 / pveRatio) - 1)
  if (pvpSinceLastPve >= pvpPerPve) {
    return { type: 'pve', pvpSinceLastPve: 0 }
  }
  return { type: 'pvp', pvpSinceLastPve: pvpSinceLastPve + 1 }
}

export function decideFightTypeForIndex({ forcedPvp, pvpSinceLastPve, pveRatio, pveOnly, characterLevel = null, pvpUnlockLevel = 1 }) {
  if (forcedPvp) {
    return { type: 'pvp', pvpSinceLastPve: pvpSinceLastPve + 1 }
  }
  return determineNextFightType(pvpSinceLastPve, pveRatio, pveOnly, characterLevel, pvpUnlockLevel)
}

export const FIGHT_START_GRACE_MS = 3000

export function isAttackableArenaStatus(status) {
  if (!status || typeof status !== 'object') return false
  if (status.isPveLocked) return false
  if (status.isResting) return false
  if (status.isSearching) return false
  if (status.isResolving) return false
  if (status.fightButtonVisible !== true) return false
  if (status.fightButtonEnabled !== true) return false
  const label = String(status.fightButtonLabel ?? '')
  return label.includes('FIGHT') || label.includes('ATTACK BOSS')
}

export function didFightStart(status) {
  if (!status || typeof status !== 'object') return false
  const body = String(status.bodyText ?? '')
  if (body.includes('No opponents found')) return true
  if (/(VICTORY|DEFEAT|DRAW)/.test(body)) return true
  if (body.includes('RESOLVING')) return true
  if (status.isResolving) return true
  const label = String(status.fightButtonLabel ?? '')
  if (label.includes('RESOLVING')) return true
  return status.fightButtonVisible === false
}
