export const COMPENDIUM_UNLOCK_EVENT = 'compendium-unlock';

export type CompendiumUnlockKind = 'bestiary' | 'armory';

export interface CompendiumUnlockDetail {
  kind: CompendiumUnlockKind;
  id: string;
  name: string;
}

export function notifyCompendiumUnlock(detail: CompendiumUnlockDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<CompendiumUnlockDetail>(COMPENDIUM_UNLOCK_EVENT, { detail }));
}
