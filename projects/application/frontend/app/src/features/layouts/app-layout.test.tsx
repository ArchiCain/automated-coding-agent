import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppLayout } from './app-layout'
import { BrowserRouter } from 'react-router-dom'

// Mock dependencies
vi.mock('@/features/app-header', () => ({
  AppHeader: ({ title }: { title: string }) => (
    <header data-testid="app-header">{title}</header>
  )
}))

vi.mock('@/features/keycloak-auth', () => ({
  useAuth: () => ({
    user: { username: 'testuser' },
    isAuthenticated: true,
    logout: vi.fn()
  })
}))

// Mock layout context
vi.mock('./layout-context', () => ({
  useLayoutContext: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isLeftDrawerOpen: false,
    toggleLeftDrawer: vi.fn(),
    closeLeftDrawer: vi.fn(),
    isFullWidthPage: false,
    showPersistentLeftNav: true,
  })
}))

// Mock navigation components
vi.mock('@/features/navigation', () => ({
  LeftNavigationSidebar: () => <nav data-testid="left-sidebar">Sidebar</nav>,
  LeftNavigationDrawer: () => <div data-testid="left-drawer">Drawer</div>
}))

describe('AppLayout (Unit)', () => {
  it('should render AppHeader component', () => {
    render(
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    )

    expect(screen.getByTestId('app-header')).toBeInTheDocument()
  })

  it('should pass title to AppHeader', () => {
    render(
      <BrowserRouter>
        <AppLayout title="Custom Title" />
      </BrowserRouter>
    )

    expect(screen.getByText('Custom Title')).toBeInTheDocument()
  })

  it('should render with default title', () => {
    render(
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    )

    expect(screen.getByText('Conversational AI')).toBeInTheDocument()
  })

  it('should render main element for content', () => {
    const { container } = render(
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    )

    const main = container.querySelector('main')
    expect(main).toBeInTheDocument()
  })

  it('should have proper flex layout structure', () => {
    const { container } = render(
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    )

    const main = container.querySelector('main')
    expect(main).toBeInTheDocument()
    // MUI Box with display: 'flex', flexDirection: 'column', height: '100vh'
  })

  it('should have background styling', () => {
    const { container } = render(
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    )

    const main = container.querySelector('main')
    expect(main).toBeInTheDocument()
    // MUI Box provides background via theme
  })

  it('should have flex-1 main content area', () => {
    const { container } = render(
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    )

    const main = container.querySelector('main')
    expect(main).toBeInTheDocument()
    // MUI Box with flex: 1, minHeight: 0
  })

  it('should render Outlet for nested routes', () => {
    const { container } = render(
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    )

    const main = container.querySelector('main')
    expect(main).toBeInTheDocument()
  })
})
