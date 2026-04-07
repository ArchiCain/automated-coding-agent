import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Stack,
  Skeleton,
  Alert,
  Chip,
  Button,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import TaskCard from "./task-card";
import { useApi, useSocket } from "../api-client";
import { useTaskDialog } from "../layout";
import type { Task, TaskStatus } from "../shared";

interface OutletContextValue {
  refreshKey: number;
}

interface KanbanColumn {
  label: string;
  statuses: TaskStatus[];
  color: string;
}

const COLUMNS: KanbanColumn[] = [
  { label: "Queued", statuses: ["queued"], color: "#9e9e9e" },
  { label: "Assigned", statuses: ["assigned", "setting_up"], color: "#2196f3" },
  { label: "Implementing", statuses: ["implementing"], color: "#ff9800" },
  { label: "Validating", statuses: ["validating"], color: "#9c27b0" },
  { label: "Submitting", statuses: ["submitting"], color: "#00bcd4" },
  { label: "Completed", statuses: ["completed"], color: "#4caf50" },
  { label: "Failed", statuses: ["failed", "escalated"], color: "#f44336" },
];

export default function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();
  const socket = useSocket();
  const { openTaskDialog } = useTaskDialog();
  const { refreshKey } = useOutletContext<OutletContextValue>();

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<Task[]>("/tasks");
      setTasks(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load tasks",
      );
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks, refreshKey]);

  useEffect(() => {
    if (!socket) return;

    const handleTaskUpdate = (data: Task) => {
      setTasks((prev) => {
        const exists = prev.find((t) => t.id === data.id);
        if (exists) {
          return prev.map((t) => (t.id === data.id ? data : t));
        }
        return [data, ...prev];
      });
    };

    socket.on("task:update", handleTaskUpdate);
    return () => {
      socket.off("task:update", handleTaskUpdate);
    };
  }, [socket]);

  const getTasksByStatuses = (statuses: TaskStatus[]) =>
    tasks.filter((t) => statuses.includes(t.status));

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 3 }} />
        <Box sx={{ display: "flex", gap: 2, overflowX: "auto" }}>
          {COLUMNS.map((col) => (
            <Skeleton
              key={col.label}
              variant="rounded"
              width={280}
              height={400}
              sx={{ flexShrink: 0 }}
            />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 3,
        }}
      >
        <Typography variant="h4">Task Board</Typography>
        <Button
          variant="contained"
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
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: "flex",
          gap: 2,
          overflowX: "auto",
          pb: 2,
          minHeight: "calc(100vh - 200px)",
        }}
      >
        {COLUMNS.map((col) => {
          const columnTasks = getTasksByStatuses(col.statuses);
          return (
            <Paper
              key={col.label}
              sx={{
                width: 280,
                minWidth: 280,
                flexShrink: 0,
                p: 2,
                backgroundColor: "rgba(255,255,255,0.02)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 2,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: col.color,
                    }}
                  />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {col.label}
                  </Typography>
                </Box>
                <Chip
                  label={columnTasks.length}
                  size="small"
                  sx={{ height: 20, fontSize: 11 }}
                />
              </Box>

              <Stack spacing={1.5} sx={{ flex: 1 }}>
                {columnTasks.length === 0 ? (
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      textAlign: "center",
                      py: 4,
                    }}
                  >
                    No tasks
                  </Typography>
                ) : (
                  columnTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))
                )}
              </Stack>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}
