import {
  Card,
  CardContent,
  Typography,
  Chip,
  LinearProgress,
  Box,
  Stack,
} from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import type { AgentSlot, AgentSlotStatus } from "../shared";

const statusColors: Record<
  AgentSlotStatus,
  "default" | "success" | "error" | "warning" | "info"
> = {
  idle: "default",
  active: "success",
  error: "error",
  starting: "warning",
};

function formatElapsed(startedAt?: string): string {
  if (!startedAt) return "--";
  const elapsed = Date.now() - new Date(startedAt).getTime();
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

interface AgentCardProps {
  slot: AgentSlot;
  onClick?: () => void;
}

export default function AgentCard({ slot, onClick }: AgentCardProps) {
  const isActive = slot.status === "active";

  return (
    <Card
      onClick={onClick}
      sx={{
        height: "100%",
        position: "relative",
        overflow: "visible",
        cursor: onClick ? "pointer" : "default",
        transition: "transform 0.2s, box-shadow 0.2s",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: (theme) => `0 8px 24px ${theme.palette.primary.dark}40`,
        },
        ...(isActive && {
          borderColor: "secondary.main",
          borderWidth: 1,
          borderStyle: "solid",
        }),
      }}
    >
      {isActive && (
        <LinearProgress
          color="secondary"
          variant={slot.progress ? "determinate" : "indeterminate"}
          value={slot.progress}
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            borderRadius: "12px 12px 0 0",
          }}
        />
      )}
      <CardContent>
        <Stack spacing={1.5}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <SmartToyIcon
                sx={{
                  color: isActive ? "secondary.main" : "text.secondary",
                  fontSize: 28,
                }}
              />
              <Typography variant="h6" sx={{ fontSize: "1.1rem" }}>
                Slot {slot.id}
              </Typography>
            </Box>
            <Chip
              label={slot.status}
              color={statusColors[slot.status]}
              size="small"
              sx={{ fontWeight: 600, textTransform: "uppercase", fontSize: 11 }}
            />
          </Box>

          {slot.taskTitle ? (
            <Typography
              variant="body2"
              sx={{
                color: "text.primary",
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {slot.taskTitle}
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              No task assigned
            </Typography>
          )}

          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {slot.currentRole && (
              <Chip
                label={slot.currentRole}
                variant="outlined"
                size="small"
                sx={{ fontSize: 11 }}
              />
            )}
            {isActive && (
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", fontFamily: "monospace" }}
              >
                {formatElapsed(slot.startedAt)}
              </Typography>
            )}
          </Box>

          {slot.lastMessage && (
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontFamily: "monospace",
                fontSize: 11,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "block",
              }}
            >
              {slot.lastMessage}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
