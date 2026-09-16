import { useSyncExternalStore } from 'react';

export type SpriteTheme = 'color' | 'gb';

const STORAGE_KEY = 'bitbrawler_sprite_theme';

function loadTheme(): SpriteTheme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'gb' ? 'gb' : 'color';
  } catch {
    return 'color';
  }
}

let current: SpriteTheme = loadTheme();
const listeners = new Set<() => void>();

export function getSpriteTheme(): SpriteTheme {
  return current;
}

export function setSpriteTheme(theme: SpriteTheme): void {
  if (current === theme) return;
  current = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useSpriteTheme(): SpriteTheme {
  return useSyncExternalStore(subscribe, getSpriteTheme, getSpriteTheme);
}
