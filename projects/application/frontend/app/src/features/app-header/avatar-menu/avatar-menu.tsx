import { useEffect, useRef } from "react";
import { Box, Avatar, Menu } from "@mui/material";
import type { AvatarMenuProps } from "./types";

export function AvatarMenu({ isOpen, onToggle, children }: AvatarMenuProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(event.target as Node)) {
        if (isOpen) onToggle(); // Close menu if clicking outside
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <Box ref={anchorRef} sx={{ position: 'relative', zIndex: 50 }}>
      <Avatar
        onClick={onToggle}
        sx={{
          width: 32,
          height: 32,
          bgcolor: 'grey.300',
          color: 'text.secondary',
          cursor: 'pointer',
          fontSize: '1.5rem',
          transition: 'color 0.2s',
          '&:hover': {
            color: 'primary.main',
          },
        }}
      >
        👤
      </Avatar>
      <Menu
        anchorEl={anchorRef.current}
        open={isOpen}
        onClose={onToggle}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        sx={{
          mt: 1,
          '& .MuiPaper-root': {
            minWidth: '12rem',
          },
        }}
      >
        {children}
      </Menu>
    </Box>
  );
}
