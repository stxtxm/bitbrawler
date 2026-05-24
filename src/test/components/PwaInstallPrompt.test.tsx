import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import PwaInstallPrompt from '../../components/PwaInstallPrompt'

// Mock PixelIcon to avoid SVG rendering complexity in tests
vi.mock('../../components/PixelIcon', () => ({
  PixelIcon: ({ type }: { type: string }) => <span data-testid={`icon-${type}`} />,
}))

describe('PwaInstallPrompt', () => {
  beforeEach(() => {
    // Default: not installed
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

  it('should render nothing when no beforeinstallprompt event fired', () => {
    const { container } = render(<PwaInstallPrompt />)
    expect(container.innerHTML).toBe('')
  })

  it('should render install banner after beforeinstallprompt event', () => {
    render(<PwaInstallPrompt />)

    act(() => {
      const event = new Event('beforeinstallprompt')
      Object.assign(event, {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'dismissed' }),
      })
      window.dispatchEvent(event)
    })

    expect(screen.getByText('INSTALL BITBRAWLER')).toBeInTheDocument()
    expect(screen.getByText('INSTALL')).toBeInTheDocument()
    expect(screen.getByText('LATER')).toBeInTheDocument()
  })

  it('should not show banner when already installed', () => {
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

    const { container } = render(<PwaInstallPrompt />)
    expect(container.innerHTML).toBe('')
  })

  it('should hide banner after clicking Later', () => {
    render(<PwaInstallPrompt />)

    act(() => {
      const event = new Event('beforeinstallprompt')
      Object.assign(event, {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'dismissed' }),
      })
      window.dispatchEvent(event)
    })

    expect(screen.getByText('INSTALL BITBRAWLER')).toBeInTheDocument()

    act(() => {
      screen.getByText('LATER').click()
    })

    expect(screen.queryByText('INSTALL BITBRAWLER')).not.toBeInTheDocument()
  })

  it('should call native prompt on Install click and hide banner after accepted', async () => {
    const mockPrompt = vi.fn()

    render(<PwaInstallPrompt />)

    act(() => {
      const event = new Event('beforeinstallprompt')
      Object.assign(event, {
        prompt: mockPrompt,
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      })
      window.dispatchEvent(event)
    })

    expect(screen.getByText('INSTALL BITBRAWLER')).toBeInTheDocument()

    await act(async () => {
      screen.getByText('INSTALL').click()
    })

    expect(mockPrompt).toHaveBeenCalled()
    expect(screen.queryByText('INSTALL BITBRAWLER')).not.toBeInTheDocument()
  })

  it('should hide banner after Install click with dismissed outcome', async () => {
    const mockPrompt = vi.fn()

    render(<PwaInstallPrompt />)

    act(() => {
      const event = new Event('beforeinstallprompt')
      Object.assign(event, {
        prompt: mockPrompt,
        userChoice: Promise.resolve({ outcome: 'dismissed' }),
      })
      window.dispatchEvent(event)
    })

    expect(screen.getByText('INSTALL BITBRAWLER')).toBeInTheDocument()

    await act(async () => {
      screen.getByText('INSTALL').click()
    })

    expect(mockPrompt).toHaveBeenCalled()
    expect(screen.queryByText('INSTALL BITBRAWLER')).not.toBeInTheDocument()
  })

  it('should render the install steps', () => {
    render(<PwaInstallPrompt />)

    act(() => {
      const event = new Event('beforeinstallprompt')
      Object.assign(event, {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'dismissed' }),
      })
      window.dispatchEvent(event)
    })

    expect(screen.getByText(/1. Tap/)).toBeInTheDocument()
    expect(screen.getByText(/2. Play offline/)).toBeInTheDocument()
    expect(screen.getByText(/3. Faster loading/)).toBeInTheDocument()
  })

  it('should not show banner if no beforeinstallprompt ever fires', () => {
    const { container } = render(<PwaInstallPrompt />)
    expect(container.innerHTML).toBe('')

    // Still nothing after timeout
    expect(screen.queryByText('INSTALL BITBRAWLER')).not.toBeInTheDocument()
  })
})
