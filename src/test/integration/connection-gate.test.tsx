import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useConnectionGate } from '../../hooks/useConnectionGate'
import { useGame } from '../../context/GameContext'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

vi.mock('../../context/GameContext', () => ({
  useGame: vi.fn(),
}))

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(),
}))

const mockUseGame = useGame as unknown as ReturnType<typeof vi.fn>
const mockUseOnlineStatus = useOnlineStatus as unknown as ReturnType<typeof vi.fn>

describe('useConnectionGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens modal when offline', async () => {
    mockUseOnlineStatus.mockReturnValue(false)
    const retryConnection = vi.fn().mockResolvedValue(true)
    mockUseGame.mockReturnValue({
      firebaseAvailable: true,
      retryConnection,
    })

    const { result } = renderHook(() => useConnectionGate())
    let allowed = true
    await act(async () => {
      allowed = await result.current.ensureConnection('Need connection')
    })

    expect(allowed).toBe(false)
    expect(retryConnection).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.connectionModal.open).toBe(true))
    expect(result.current.connectionModal.message).toBe('Need connection')
  })

  it('opens modal when retry fails', async () => {
    mockUseOnlineStatus.mockReturnValue(true)
    const retryConnection = vi.fn().mockResolvedValue(false)
    mockUseGame.mockReturnValue({
      firebaseAvailable: false,
      retryConnection,
    })

    const { result } = renderHook(() => useConnectionGate())
    let allowed = true
    await act(async () => {
      allowed = await result.current.ensureConnection('Retry failed')
    })

    expect(allowed).toBe(false)
    expect(retryConnection).toHaveBeenCalled()
    await waitFor(() => expect(result.current.connectionModal.open).toBe(true))
    expect(result.current.connectionModal.message).toBe('Retry failed')
  })

  it('allows action when retry succeeds', async () => {
    mockUseOnlineStatus.mockReturnValue(true)
    const retryConnection = vi.fn().mockResolvedValue(true)
    mockUseGame.mockReturnValue({
      firebaseAvailable: false,
      retryConnection,
    })

    const { result } = renderHook(() => useConnectionGate())
    let allowed = false
    await act(async () => {
      allowed = await result.current.ensureConnection('Should not open')
    })

    expect(allowed).toBe(true)
    expect(retryConnection).toHaveBeenCalled()
    expect(result.current.connectionModal.open).toBe(false)
  })

  it('supports manual open and close', async () => {
    // Mock as offline to prevent auto-close
    mockUseOnlineStatus.mockReturnValue(false)
    mockUseGame.mockReturnValue({
      firebaseAvailable: false,
      retryConnection: vi.fn(),
    })

    const { result } = renderHook(() => useConnectionGate())
    act(() => {
      result.current.openModal('Manual')
    })

    await waitFor(() => expect(result.current.connectionModal.open).toBe(true))
    expect(result.current.connectionModal.message).toBe('Manual')

    act(() => {
      result.current.closeModal()
    })

    await waitFor(() => expect(result.current.connectionModal.open).toBe(false))
  })

  it('auto-closes modal when connection becomes available', async () => {
    mockUseOnlineStatus.mockReturnValue(false)
    mockUseGame.mockReturnValue({
      firebaseAvailable: false,
      retryConnection: vi.fn(),
    })

    const { result, rerender } = renderHook(() => useConnectionGate())

    act(() => {
      result.current.openModal('Should auto-close')
    })

    await waitFor(() => expect(result.current.connectionModal.open).toBe(true))

    // Switch to online/available
    mockUseOnlineStatus.mockReturnValue(true)
    mockUseGame.mockReturnValue({
      firebaseAvailable: true,
      retryConnection: vi.fn(),
    })

    rerender()

    await waitFor(() => expect(result.current.connectionModal.open).toBe(false))
  })
})
