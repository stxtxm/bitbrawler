export declare const PERSISTENT_RESET_LEVEL_HEADROOM: number

export declare function persistentNameForGeneration(baseName: string, generation: number): string

export declare function shouldForcePersistentReset(
  currentLevel: number | null | undefined,
  maxLevel?: number,
  headroom?: number,
): boolean

export declare function parseLevelFromText(text: string): number | null

export declare const COMBAT_SPEED_STORAGE_KEY: string
export declare const COMBAT_SPEED_OPTIONS: readonly [1, 2]
export declare const COMBAT_SPEED_TOGGLE_SELECTOR: string
export declare const COMBAT_SPEED_SETTINGS_SELECTOR: string

export declare function isCombatSpeed(value: unknown): value is 1 | 2
export declare function parseCombatSpeed(value: unknown): 1 | 2 | null
export declare function parseCombatSpeedText(text: string): 1 | 2 | null
export declare function getCombatSpeedFromStorageRaw(raw: string | null): 1 | 2
export declare function nextCombatSpeed(current: number): 1 | 2

export declare const SITE_DOWN_ERROR_PREFIX: string
export declare function isSiteDownStatus(status: unknown): boolean
export declare function looksLikeErrorPage(bodyText: string): boolean
export declare function hasGameContent(bodyText: string): boolean
export declare function buildSiteDownMessage(status: number, url: string): string
export declare function buildSiteDownBodyMessage(url: string): string
export declare function throwIfSiteDownResponse(
  response: { status: () => number } | { status: number } | null | undefined,
  url: string,
): void
export declare function throwIfErrorPageBody(
  bodyText: string,
  url: string,
  hasGameSelector?: boolean,
): void
export declare function classifyRunError(message: string): 'site_down' | 'flaky_locator' | 'other'
