import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../../App'
import { GameProvider } from '../../context/GameContext'

vi.mock('../../config/firebase', () => ({
  db: {
    collection: vi.fn(),
    doc: vi.fn(),
  },
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  getDocsFromServer: vi.fn(),
  updateDoc: vi.fn(),
  limit: vi.fn(),
}))

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(),
}))

import { useOnlineStatus } from '../../hooks/useOnlineStatus'

const mockUseOnlineStatus = useOnlineStatus as unknown as ReturnType<typeof vi.fn>

describe('App offline routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders arena with offline banner when snapshot exists', async () => {
    mockUseOnlineStatus.mockReturnValue(false)
    ;(localStorage.getItem as any).mockReturnValue(
      JSON.stringify({
        name: 'Test Hero',
        gender: 'male',
        seed: 'seed',
        level: 3,
        experience: 100,
        strength: 8,
        vitality: 6,
        dexterity: 7,
        luck: 5,
        intelligence: 4,
        hp: 40,
        maxHp: 40,
        wins: 2,
        losses: 1,
        fightsLeft: 3,
        lastFightReset: Date.now(),
        firestoreId: 'test-id',
      }),
    )

    const { getByText } = render(
      <MemoryRouter initialEntries={['/arena']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <GameProvider>
          <App />
        </GameProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(getByText('OFFLINE MODE')).toBeInTheDocument()
    })
  })
})
