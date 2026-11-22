import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useModalExitTransition, MODAL_EXIT_MS } from '../../hooks/useModalExitTransition';

describe('useModalExitTransition', () => {
  it('est monté quand open est true, pas de fermeture en cours', () => {
    const { result } = renderHook(() => useModalExitTransition(true));
    expect(result.current).toEqual({ mounted: true, closing: false });
  });

  it('reste monté avec closing=true pendant MODAL_EXIT_MS puis démonte', () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(
        ({ open }) => useModalExitTransition(open),
        { initialProps: { open: true } },
      );

      rerender({ open: false });
      expect(result.current).toEqual({ mounted: true, closing: true });

      act(() => { vi.advanceTimersByTime(MODAL_EXIT_MS - 1); });
      expect(result.current).toEqual({ mounted: true, closing: true });

      act(() => { vi.advanceTimersByTime(1); });
      expect(result.current).toEqual({ mounted: false, closing: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it('annule la sortie silencieusement si la modale rouvre en cours', () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(
        ({ open }) => useModalExitTransition(open),
        { initialProps: { open: true } },
      );

      rerender({ open: false });
      expect(result.current.closing).toBe(true);

      // Rouvre avant la fin du timer : closing repart à zéro immédiatement.
      rerender({ open: true });
      expect(result.current).toEqual({ mounted: true, closing: false });

      // Le timer de sortie ne doit pas couper après le délai.
      act(() => { vi.advanceTimersByTime(MODAL_EXIT_MS + 50); });
      expect(result.current).toEqual({ mounted: true, closing: false });
    } finally {
      vi.useRealTimers();
    }
  });
});
