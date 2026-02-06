import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { useGame } from '../context/GameContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

vi.mock('../context/GameContext', () => ({
  useGame: vi.fn(),
}))

vi.mock('../hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(),
}))

const mockUseGame = useGame as unknown as ReturnType<typeof vi.fn>
const mockUseOnlineStatus = useOnlineStatus as unknown as ReturnType<typeof vi.fn>

describe('Daily reset UI gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading screen when daily reset is due', () => {
    mockUseOnlineStatus.mockReturnValue(true)
    mockUseGame.mockReturnValue({
      activeCharacter: { lastFightReset: Date.now() - 86400000 },
      loading: false,
      firebaseAvailable: true,
    })

    const { getByText } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </MemoryRouter>
    )

    expect(getByText('LOADING...')).toBeInTheDocument()
  })
})
