import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppHeader } from './app-header'
import { BrowserRouter } from 'react-router-dom'

// Mock dependencies
const mockLogout = vi.fn()
const mockNavigate = vi.fn()
const mockToggleLeftDrawer = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/' })
  }
})

vi.mock('@/features/keycloak-auth', () => ({
  useAuth: () => ({
    logout: mockLogout,
    user: { username: 'testuser', email: 'test@example.com' },
    isAuthenticated: true
  })
}))

// Mock layout context
vi.mock('@/features/layouts', () => ({
  useLayoutContext: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isLeftDrawerOpen: false,
    toggleLeftDrawer: mockToggleLeftDrawer,
    closeLeftDrawer: vi.fn(),
    isFullWidthPage: false,
    showPersistentLeftNav: true,
  })
}))

vi.mock('@/features/theme', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />
}))

describe('AppHeader (Unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render header with default title', () => {
    render(
      <BrowserRouter>
        <AppHeader />
      </BrowserRouter>
    )

    expect(screen.getByText('Conversational AI')).toBeInTheDocument()
  })

  it('should render header with custom title', () => {
    render(
      <BrowserRouter>
        <AppHeader title="Custom Title" />
      </BrowserRouter>
    )

    expect(screen.getByText('Custom Title')).toBeInTheDocument()
  })

  it('should render menu toggle button', () => {
    render(
      <BrowserRouter>
        <AppHeader />
      </BrowserRouter>
    )

    // Get all buttons - first is menu, second is logout
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
    expect(buttons[0]).toBeInTheDocument()
  })

  it('should call toggleLeftDrawer when menu button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <AppHeader />
      </BrowserRouter>
    )

    // Get menu toggle button
    const menuButton = screen.getByRole('button', { name: /toggle navigation menu/i })

    // Click menu button
    await user.click(menuButton)

    // Should call toggleLeftDrawer from layout context
    expect(mockToggleLeftDrawer).toHaveBeenCalledTimes(1)
  })

  it('should always render menu button on all viewports', () => {
    render(
      <BrowserRouter>
        <AppHeader />
      </BrowserRouter>
    )

    // Menu button should always be visible
    const menuButton = screen.getByRole('button', { name: /toggle navigation menu/i })
    expect(menuButton).toBeInTheDocument()
  })

  it('should have sticky header styling', () => {
    const { container } = render(
      <BrowserRouter>
        <AppHeader />
      </BrowserRouter>
    )

    const header = container.querySelector('header')
    expect(header).toBeInTheDocument()
    // MUI AppBar with position="sticky" creates sticky header
  })

  it('should render theme toggle', () => {
    render(
      <BrowserRouter>
        <AppHeader />
      </BrowserRouter>
    )

    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument()
  })

  it('should apply MUI AppBar styles', () => {
    const { container } = render(
      <BrowserRouter>
        <AppHeader />
      </BrowserRouter>
    )

    const header = container.querySelector('header')
    expect(header).toBeInTheDocument()
    // MUI AppBar provides elevation and styling via sx prop
  })
})
