import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './features/keycloak-auth';
import { MuiThemeProvider } from './features/mui-theme';

// Import Roboto font for Material Design
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <MuiThemeProvider>
        <App />
      </MuiThemeProvider>
    </AuthProvider>
  </StrictMode>,
)
