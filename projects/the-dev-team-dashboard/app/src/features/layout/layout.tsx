import { useState, createContext, useContext, useCallback } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import AddIcon from "@mui/icons-material/Add";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import TerminalIcon from "@mui/icons-material/Terminal";
import CloudIcon from "@mui/icons-material/Cloud";
import HistoryIcon from "@mui/icons-material/History";
import BarChartIcon from "@mui/icons-material/BarChart";
import { TaskSubmissionDialog } from "../task-submission";

const DRAWER_WIDTH = 240;

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactElement;
}

const navItems: NavItem[] = [
  { label: "Overview", path: "/", icon: <DashboardIcon /> },
  { label: "Task Board", path: "/tasks", icon: <ViewKanbanIcon /> },
  { label: "Agent Detail", path: "/agents/live", icon: <TerminalIcon /> },
  { label: "Environments", path: "/environments", icon: <CloudIcon /> },
  { label: "History", path: "/history", icon: <HistoryIcon /> },
  { label: "Metrics", path: "/metrics", icon: <BarChartIcon /> },
];

interface TaskDialogContextValue {
  openTaskDialog: () => void;
}

const TaskDialogContext = createContext<TaskDialogContextValue>({
  openTaskDialog: () => {},
});

export function useTaskDialog(): TaskDialogContextValue {
  return useContext(TaskDialogContext);
}

export default function Layout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  const handleNav = (path: string) => {
    navigate(path);
    if (isMobile) setMobileOpen(false);
  };

  const isSelected = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const openTaskDialog = useCallback(() => {
    setTaskDialogOpen(true);
  }, []);

  const handleTaskSuccess = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const drawerContent = (
    <Box sx={{ pt: 1 }}>
      <List>
        {navItems.map((item) => (
          <ListItemButton
            key={item.path}
            selected={isSelected(item.path)}
            onClick={() => handleNav(item.path)}
            sx={{
              mx: 1,
              borderRadius: 2,
              mb: 0.5,
              "&.Mui-selected": {
                backgroundColor: "primary.dark",
                "&:hover": {
                  backgroundColor: "primary.main",
                },
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 40,
                color: isSelected(item.path)
                  ? "secondary.light"
                  : "text.secondary",
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                fontSize: 14,
                fontWeight: isSelected(item.path) ? 600 : 400,
              }}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <TaskDialogContext.Provider value={{ openTaskDialog }}>
      <Box sx={{ display: "flex", minHeight: "100vh" }}>
        <AppBar
          position="fixed"
          elevation={0}
          sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}
        >
          <Toolbar>
            {isMobile && (
              <IconButton
                edge="start"
                color="inherit"
                onClick={() => setMobileOpen(!mobileOpen)}
                sx={{ mr: 2 }}
              >
                <MenuIcon />
              </IconButton>
            )}
            <Typography
              variant="h6"
              noWrap
              sx={{
                fontWeight: 700,
                letterSpacing: "0.05em",
                background: "linear-gradient(135deg, #534bae 0%, #4ebaaa 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                flexGrow: 1,
              }}
            >
              THE Dev Team
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={openTaskDialog}
              sx={{
                background: "linear-gradient(135deg, #534bae 0%, #4ebaaa 100%)",
                fontWeight: 600,
                textTransform: "none",
                "&:hover": {
                  background: "linear-gradient(135deg, #3f37a1 0%, #3da898 100%)",
                },
              }}
            >
              New Task
            </Button>
          </Toolbar>
        </AppBar>

        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              "& .MuiDrawer-paper": { width: DRAWER_WIDTH },
            }}
          >
            <Toolbar />
            {drawerContent}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            sx={{
              width: DRAWER_WIDTH,
              flexShrink: 0,
              "& .MuiDrawer-paper": { width: DRAWER_WIDTH },
            }}
          >
            <Toolbar />
            {drawerContent}
          </Drawer>
        )}

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            mt: 8,
            width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          }}
        >
          <Outlet context={{ refreshKey }} />
        </Box>

        <TaskSubmissionDialog
          open={taskDialogOpen}
          onClose={() => setTaskDialogOpen(false)}
          onSuccess={handleTaskSuccess}
        />
      </Box>
    </TaskDialogContext.Provider>
  );
}
