import { Card, CardContent, Typography, Chip, Box, Stack } from "@mui/material";
import BugReportIcon from "@mui/icons-material/BugReport";
import GitHubIcon from "@mui/icons-material/GitHub";
import ApiIcon from "@mui/icons-material/Api";
import ChatIcon from "@mui/icons-material/Chat";
import EditIcon from "@mui/icons-material/Edit";
import type { Task, TaskSource, TaskPriority } from "../shared";

const sourceIcons: Record<TaskSource, React.ReactElement> = {
  github_issue: <GitHubIcon sx={{ fontSize: 16 }} />,
  slack: <ChatIcon sx={{ fontSize: 16 }} />,
  api: <ApiIcon sx={{ fontSize: 16 }} />,
  manual: <EditIcon sx={{ fontSize: 16 }} />,
};

const priorityColors: Record<
  TaskPriority,
  "default" | "info" | "warning" | "error"
> = {
  low: "default",
  medium: "info",
  high: "warning",
  critical: "error",
};

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
}

export default function TaskCard({ task, onClick }: TaskCardProps) {
  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: onClick ? "pointer" : "default",
        transition: "transform 0.15s, box-shadow 0.15s",
        "&:hover": onClick
          ? {
              transform: "translateY(-1px)",
              boxShadow: (theme) =>
                `0 4px 16px ${theme.palette.primary.dark}30`,
            }
          : {},
      }}
    >
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack spacing={1}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {task.title}
          </Typography>

          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            <Chip
              icon={sourceIcons[task.source]}
              label={task.source.replace("_", " ")}
              size="small"
              variant="outlined"
              sx={{ fontSize: 10, height: 22 }}
            />
            <Chip
              icon={<BugReportIcon sx={{ fontSize: 14 }} />}
              label={task.priority}
              color={priorityColors[task.priority]}
              size="small"
              sx={{ fontSize: 10, height: 22 }}
            />
          </Box>

          {task.branch && (
            <Typography
              variant="caption"
              sx={{
                fontFamily: "monospace",
                color: "secondary.light",
                fontSize: 11,
              }}
            >
              {task.branch}
            </Typography>
          )}

          {task.cost !== undefined && (
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", fontSize: 11 }}
            >
              Cost: ${task.cost.toFixed(4)}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
