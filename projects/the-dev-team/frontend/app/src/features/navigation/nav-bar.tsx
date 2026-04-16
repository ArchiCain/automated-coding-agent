import { useLocation, useNavigate } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TerminalIcon from '@mui/icons-material/Terminal';
import DashboardIcon from '@mui/icons-material/Dashboard';
import StorageIcon from '@mui/icons-material/Storage';
import MenuBookIcon from '@mui/icons-material/MenuBook';

export function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isEnvRoute = location.pathname === '/' || location.pathname.startsWith('/env');

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar variant="dense">
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          <TerminalIcon sx={{ color: 'secondary.main' }} />
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary' }}
          >
            THE Dev Team
          </Typography>
        </Box>
        <Box sx={{ ml: 4, display: 'flex', gap: 1 }}>
          <Button
            size="small"
            color={isEnvRoute ? 'primary' : 'inherit'}
            onClick={() => navigate('/')}
            startIcon={<DashboardIcon />}
            sx={{ textTransform: 'none', fontSize: '0.8rem' }}
          >
            Environments
          </Button>
          <Button
            size="small"
            color={location.pathname === '/devops' ? 'primary' : 'inherit'}
            onClick={() => navigate('/devops')}
            startIcon={<StorageIcon />}
            sx={{ textTransform: 'none', fontSize: '0.8rem' }}
          >
            Cluster
          </Button>
          <Button
            size="small"
            color={location.pathname === '/docs' ? 'primary' : 'inherit'}
            onClick={() => navigate('/docs')}
            startIcon={<MenuBookIcon />}
            sx={{ textTransform: 'none', fontSize: '0.8rem' }}
          >
            Docs
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
