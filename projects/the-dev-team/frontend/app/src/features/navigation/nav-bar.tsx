import { useLocation, useNavigate } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TerminalIcon from '@mui/icons-material/Terminal';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import CloudIcon from '@mui/icons-material/Cloud';

export function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();

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
          onClick={() => navigate('/docs')}
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
            color={location.pathname === '/docs' ? 'primary' : 'inherit'}
            onClick={() => navigate('/docs')}
            startIcon={<MenuBookIcon />}
            sx={{ textTransform: 'none', fontSize: '0.8rem' }}
          >
            Docs
          </Button>
          <Button
            size="small"
            color={location.pathname.startsWith('/env') ? 'primary' : 'inherit'}
            onClick={() => navigate('/environments')}
            startIcon={<CloudIcon />}
            sx={{ textTransform: 'none', fontSize: '0.8rem' }}
          >
            Environments
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
