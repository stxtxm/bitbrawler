import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { gbOf, remapPaletteGb, GB_SHADES } from '../../components/sprite/spritePalettes';
import { getSpriteTheme, setSpriteTheme, useSpriteTheme } from '../../components/sprite/spriteTheme';

describe('gameboy palette', () => {
  it('maps dark colors to dark shades and light colors to light shades', () => {
    expect(gbOf('#000000')).toBe(GB_SHADES[0]);
    expect(gbOf('#ffffff')).toBe(GB_SHADES[3]);
  });

  it('remaps a full palette while keeping transparent cells', () => {
    const out = remapPaletteGb({ 0: 'transparent', 1: '#f5c6a5', 4: '#1a1a1a' });
    expect(out[0]).toBe('transparent');
    expect(Object.values(out).slice(1).every((c) => (GB_SHADES as string[]).includes(c))).toBe(true);
  });
});

describe('sprite theme store', () => {
  beforeEach(() => {
    setSpriteTheme('color');
  });

  it('defaults to color and toggles to gb', () => {
    expect(getSpriteTheme()).toBe('color');
    const { result } = renderHook(() => useSpriteTheme());
    act(() => {
      setSpriteTheme('gb');
    });
    expect(result.current).toBe('gb');
    expect(getSpriteTheme()).toBe('gb');
  });
});
