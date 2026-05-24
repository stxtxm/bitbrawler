import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePwaInstall } from '../../hooks/usePwaInstall'

describe('usePwaInstall', () => {
  beforeEach(() => {
    // Mock matchMedia for "not installed" state by default
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should start with isInstallable false when no prompt event', () => {
    const { result } = renderHook(() => usePwaInstall())
    expect(result.current.isInstallable).toBe(false)
    expect(result.current.isInstalled).toBe(false)
    expect(result.current.isDismissed).toBe(false)
  })

  it('should set isInstallable true after receiving beforeinstallprompt event', () => {
    const { result } = renderHook(() => usePwaInstall())

    act(() => {
      const event = new Event('beforeinstallprompt')
      Object.assign(event, {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'dismissed' }),
      })
      window.dispatchEvent(event)
    })

    expect(result.current.isInstallable).toBe(true)
  })

  it('should set isInstalled true after appinstalled event', () => {
    const { result } = renderHook(() => usePwaInstall())

    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })

    expect(result.current.isInstalled).toBe(true)
    expect(result.current.isInstallable).toBe(false)
  })

  it('should not show installable after appinstalled', () => {
    const { result } = renderHook(() => usePwaInstall())

    act(() => {
      const event = new Event('beforeinstallprompt')
      Object.assign(event, {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      })
      window.dispatchEvent(event)
    })

    expect(result.current.isInstallable).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })

    expect(result.current.isInstallable).toBe(false)
    expect(result.current.isInstalled).toBe(true)
  })

  it('should handle install() with accepted outcome', async () => {
    const { result } = renderHook(() => usePwaInstall())

    const mockPrompt = vi.fn()
    act(() => {
      const event = new Event('beforeinstallprompt')
      Object.assign(event, {
        prompt: mockPrompt,
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      })
      window.dispatchEvent(event)
    })

    expect(result.current.isInstallable).toBe(true)

    await act(async () => {
      await result.current.install()
    })

    expect(mockPrompt).toHaveBeenCalled()
    expect(result.current.isInstallable).toBe(false)
    expect(result.current.isInstalled).toBe(true)
  })

  it('should handle install() with dismissed outcome', async () => {
    const { result } = renderHook(() => usePwaInstall())

    const mockPrompt = vi.fn()
    act(() => {
      const event = new Event('beforeinstallprompt')
      Object.assign(event, {
        prompt: mockPrompt,
        userChoice: Promise.resolve({ outcome: 'dismissed' }),
      })
      window.dispatchEvent(event)
    })

    expect(result.current.isInstallable).toBe(true)

    await act(async () => {
      await result.current.install()
    })

    expect(mockPrompt).toHaveBeenCalled()
    expect(result.current.isDismissed).toBe(true)
    expect(result.current.isInstallable).toBe(false)
    expect(result.current.isInstalled).toBe(false)
  })

  it('should not call prompt if install() called without event', async () => {
    const { result } = renderHook(() => usePwaInstall())

    await act(async () => {
      await result.current.install()
    })

    expect(result.current.isInstallable).toBe(false)
  })

  it('should dismiss without calling native prompt', () => {
    const { result } = renderHook(() => usePwaInstall())

    act(() => {
      const event = new Event('beforeinstallprompt')
      Object.assign(event, {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'dismissed' }),
      })
      window.dispatchEvent(event)
    })

    expect(result.current.isInstallable).toBe(true)

    act(() => {
      result.current.dismiss()
    })

    expect(result.current.isDismissed).toBe(true)
    expect(result.current.isInstallable).toBe(false)
  })

  it('should detect already installed via display-mode media query', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
      writable: true,
    })

    const { result } = renderHook(() => usePwaInstall())
    expect(result.current.isInstalled).toBe(true)
    expect(result.current.isInstallable).toBe(false)
  })

  it('should clean up event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => usePwaInstall())

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('appinstalled', expect.any(Function))
  })
})
