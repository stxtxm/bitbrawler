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

export declare interface FightTypeDecision {
  type: 'pvp' | 'pve'
  pvpSinceLastPve: number
}

export declare function determineNextFightType(
  pvpSinceLastPve: number,
  pveRatio: number,
  pveOnly: boolean,
  characterLevel?: number | null,
  pvpUnlockLevel?: number,
): FightTypeDecision

export declare interface FightTypeDecisionInput {
  forcedPvp: boolean
  pvpSinceLastPve: number
  pveRatio: number
  pveOnly: boolean
  characterLevel?: number | null
  pvpUnlockLevel?: number
}

export declare function decideFightTypeForIndex(input: FightTypeDecisionInput): FightTypeDecision

export declare const FIGHT_START_GRACE_MS: number

export declare interface ArenaStatusInput {
  fightButtonVisible?: boolean
  fightButtonEnabled?: boolean
  fightButtonLabel?: string | null
  isPveLocked?: boolean
  isResting?: boolean
  isSearching?: boolean
  isResolving?: boolean
  bodyText?: string | null
  bossLockedLevel?: number | null
}

export declare function isAttackableArenaStatus(status: ArenaStatusInput | null | undefined): boolean

export declare function didFightStart(status: ArenaStatusInput | null | undefined): boolean

export declare function shouldSkipForEnergy(fightsAvailable: number | null | undefined): boolean

export declare function capFightAttempts(fightsPerRun: number, fightsAvailable: number | null | undefined): number

export declare interface SkippedFightEntry {
  index?: number
  reason?: string | null
}

export declare function aggregateSkipReasons(
  skippedFights: SkippedFightEntry[] | null | undefined,
): Record<string, number>

export declare function formatSkipSummary(summary: Record<string, number> | null | undefined): string

export declare interface QaCohort {
  /** Nom du profil persistant (`QA-FRESH`, `QA-MID`, `QA-END`). */
  name: string
  /** Niveau minimum du personnage pour ce profil. */
  minLevel?: number
  /** Niveau maximum (absent = pas de plafond). */
  maxLevel?: number
  /** Dépense maximale (💎) pour une seule offre shop (#1230). */
  essenceBudget: number
}

export declare function resolveShopCohort(
  cohorts: QaCohort[] | null | undefined,
  level: number | null | undefined,
  explicitName?: string | null,
): QaCohort | null

export declare function isPurchaseWithinBudget(price: number | null | undefined, budget: number | null | undefined): boolean
