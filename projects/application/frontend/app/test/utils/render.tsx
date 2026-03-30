import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'
import { BrowserRouter } from 'react-router-dom'

interface CustomRenderOptions extends RenderOptions {
  withRouter?: boolean
  initialRoute?: string
}

export function renderWithProviders(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  const { withRouter = false, initialRoute = '/', ...renderOptions } = options || {}

  let Wrapper = ({ children }: { children: React.ReactNode }) => <>{children}</>

  if (withRouter) {
    window.history.pushState({}, 'Test page', initialRoute)
    Wrapper = ({ children }) => <BrowserRouter>{children}</BrowserRouter>
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

// Re-export everything from testing-library
export * from '@testing-library/react'
export { renderWithProviders as render }
