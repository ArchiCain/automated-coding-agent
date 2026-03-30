import { Link } from "react-router-dom";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { NavigationMenuProps } from "./types";

export function NavigationMenu({ tabs, isOpen, onClose, currentPath }: NavigationMenuProps) {
  return (
    <Drawer
      anchor="left"
      open={isOpen}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: 256,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 2 }}>
        <Typography variant="h6" fontWeight="bold">
          Navigation
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          aria-label="Close menu"
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider />

      <List sx={{ px: 1, py: 2 }}>
        {tabs.map((tab) => {
          // Fix active state logic to prevent root path from matching all paths
          const isActive = tab.path === "/"
            ? currentPath === "/"
            : currentPath.startsWith(tab.path);

          return (
            <ListItemButton
              key={tab.id}
              component={Link}
              to={tab.path}
              selected={isActive}
              onClick={onClose}
              sx={{
                borderRadius: 1,
                mb: 0.5,
              }}
            >
              <ListItemText primary={tab.name} />
            </ListItemButton>
          );
        })}
      </List>
    </Drawer>
  );
}
