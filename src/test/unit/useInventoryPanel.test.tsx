import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useInventoryPanel } from '../../hooks/useInventoryPanel';
import { ITEM_ASSETS } from '../../data/itemAssets';
import { PixelItemAsset } from '../../types/Item';

const levelState = vi.hoisted(() => ({ value: 12 }));

vi.mock('../../context/GameContext', () => ({
  useGame: () => ({ activeCharacter: { level: levelState.value } }),
}));

const getItem = (id: string): PixelItemAsset => {
  const item = ITEM_ASSETS.find((asset) => asset.id === id);
  if (!item) throw new Error(`Missing test item: ${id}`);
  return item;
};

const sword = getItem('rusty_sword');
const glimmerBlade = getItem('glimmer_blade');
const charm = getItem('lucky_charm');

describe('useInventoryPanel hook', () => {
  it('groups the inventory by equipment slot', () => {
    const { result } = renderHook(() =>
      useInventoryPanel({
        inventory: [sword.id, charm.id],
        equippedItems: [],
        previewItem: null,
      }),
    );

    expect(result.current.groupedItems.weapon.map((item) => item.id)).toEqual([sword.id]);
    expect(result.current.groupedItems.accessory.map((item) => item.id)).toEqual([charm.id]);
    expect(result.current.groupedItems.armor).toEqual([]);
  });

  it('unlocks the shop tab at the progression gate and refuses it below', () => {
    levelState.value = 12;
    const unlocked = renderHook(() =>
      useInventoryPanel({ inventory: [], equippedItems: [], previewItem: null }),
    );
    expect(unlocked.result.current.shopUnlocked).toBe(true);
    act(() => unlocked.result.current.handleTabChange('shop'));
    expect(unlocked.result.current.activeTab).toBe('shop');

    levelState.value = 1;
    const locked = renderHook(() =>
      useInventoryPanel({ inventory: [], equippedItems: [], previewItem: null }),
    );
    expect(locked.result.current.shopUnlocked).toBe(false);
    act(() => locked.result.current.handleTabChange('shop'));
    expect(locked.result.current.activeTab).toBe('inventory');
  });

  it('derives the equipped counterpart and the stat comparison for the previewed item', () => {
    const { result } = renderHook(() =>
      useInventoryPanel({
        inventory: [glimmerBlade.id],
        equippedItems: [sword],
        previewItem: glimmerBlade,
      }),
    );

    expect(result.current.equippedForPreviewSlot).toBe(sword);
    const strength = result.current.comparison.find((entry) => entry.key === 'strength');
    expect(strength).toMatchObject({ preview: 2, equipped: 1, delta: 1 });
  });

  it('exposes no equipped counterpart when the previewed slot is empty', () => {
    const { result } = renderHook(() =>
      useInventoryPanel({ inventory: [charm.id], equippedItems: [], previewItem: charm }),
    );

    expect(result.current.equippedForPreviewSlot).toBeNull();
    expect(result.current.comparison).toEqual([]);
  });
});
