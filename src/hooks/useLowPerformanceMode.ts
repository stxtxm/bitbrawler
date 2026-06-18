import { useMemo } from 'react'

export function useLowPerformanceMode(): boolean {
  return useMemo(() => {
    if (typeof navigator === 'undefined') return false

    const cores = (navigator as any).hardwareConcurrency as number | undefined
    const memory = (navigator as any).deviceMemory as number | undefined

    if (cores !== undefined && memory !== undefined) {
      return cores <= 4 && memory <= 4
    }

    return false
  }, [])
}
