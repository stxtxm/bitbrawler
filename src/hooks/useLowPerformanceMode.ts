import { useMemo } from 'react'

export function useLowPerformanceMode(): boolean {
  return useMemo(() => {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return false

    // Check for prefers-reduced-motion — disables shake, hit stop, screen flash
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (mq?.matches) return true

    const cores = (navigator as any).hardwareConcurrency as number | undefined
    const memory = (navigator as any).deviceMemory as number | undefined

    if (cores !== undefined && memory !== undefined) {
      return cores <= 4 && memory <= 4
    }

    return false
  }, [])
}

export function useRichEffects(): boolean {
  return !useLowPerformanceMode();
}
