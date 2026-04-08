import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0d1117',
      paper: '#161b22',
    },
    primary: {
      main: '#58a6ff',
    },
    secondary: {
      main: '#3fb950',
    },
    error: {
      main: '#f85149',
    },
    warning: {
      main: '#d29922',
    },
    text: {
      primary: '#e6edf3',
      secondary: '#8b949e',
    },
    divider: '#30363d',
  },
  typography: {
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", monospace',
    fontSize: 13,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0d1117',
          scrollbarWidth: 'thin',
          scrollbarColor: '#30363d #0d1117',
        },
      },
    },
  },
});
