import { useState, useEffect, useCallback } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Grid2 as Grid,
  Typography,
  Box,
  Alert,
  Skeleton,
  Stack,
  Paper,
  Chip,
  Fab,
} from "@mui/material";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AddIcon from "@mui/icons-material/Add";
import AgentCard from "./agent-card";
import { useApi, useSocket } from "../api-client";
import { useTaskDialog } from "../layout";
import type { AgentSlot, Task } from "../shared";

interface OutletContextValue {
  refreshKey: number;
}

const DEFAULT_SLOTS: AgentSlot[] = [
  { id: 1, status: "idle" },
  { id: 2, status: "idle" },
  { id: 3, status: "idle" },
  { id: 4, status: "idle" },
];

export default function Overview() {
  const [slots, setSlots] = useState<AgentSlot[]>(DEFAULT_SLOTS);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();
  const socket = useSocket();
  const navigate = useNavigate();
  const { openTaskDialog } = useTaskDialog();
  const { refreshKey } = useOutletContext<OutletContextValue>();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [slotsData, tasksData] = await Promise.all([
        api.get<AgentSlot[]>("/agents").catch(() => DEFAULT_SLOTS),
        api.get<Task[]>("/tasks?limit=5").catch(() => [] as Task[]),
      ]);
      setSlots(slotsData);
      setRecentTasks(tasksData);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard data",
      );
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void fetchData();
  }, [fetchData, refreshKey]);

  useEffect(() => {
    if (!socket) return;

    const handleAgentProgress = (data: Partial<AgentSlot> & { id: number }) => {
      setSlots((prev) =>
        prev.map((s) => (s.id === data.id ? { ...s, ...data } : s)),
      );
    };

    const handleTaskUpdate = (data: Task) => {
      setRecentTasks((prev) => {
        const exists = prev.find((t) => t.id === data.id);
        if (exists) {
          return prev.map((t) => (t.id === data.id ? data : t));
        }
        return [data, ...prev].slice(0, 5);
      });
    };

    socket.on("agent:progress", handleAgentProgress);
    socket.on("task:update", handleTaskUpdate);

    return () => {
      socket.off("agent:progress", handleAgentProgress);
      socket.off("task:update", handleTaskUpdate);
    };
  }, [socket]);

  const activeCount = slots.filter((s) => s.status === "active").length;
  const completedCount = recentTasks.filter(
    (t) => t.status === "completed",
  ).length;
  const failedCount = recentTasks.filter((t) => t.status === "failed").length;

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 3 }} />
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, lg: 3 }}>
              <Skeleton variant="rounded" height={180} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Overview
      </Typography>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error} - Showing default state
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
        <Paper
          sx={{
            px: 3,
            py: 2,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
          }}
        >
          <GroupWorkIcon color="secondary" />
          <Box>
            <Typography variant="caption" color="text.secondary">
              Active Agents
            </Typography>
            <Typography variant="h5">
              {activeCount}/{slots.length}
            </Typography>
          </Box>
        </Paper>
        <Paper
          sx={{
            px: 3,
            py: 2,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
          }}
        >
          <TaskAltIcon color="success" />
          <Box>
            <Typography variant="caption" color="text.secondary">
              Completed
            </Typography>
            <Typography variant="h5">{completedCount}</Typography>
          </Box>
        </Paper>
        <Paper
          sx={{
            px: 3,
            py: 2,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
          }}
        >
          <ErrorOutlineIcon color="error" />
          <Box>
            <Typography variant="caption" color="text.secondary">
              Failed
            </Typography>
            <Typography variant="h5">{failedCount}</Typography>
          </Box>
        </Paper>
      </Stack>

      <Typography variant="h5" sx={{ mb: 2 }}>
        Agent Slots
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {slots.map((slot) => (
          <Grid key={slot.id} size={{ xs: 12, sm: 6, lg: 3 }}>
            <AgentCard
              slot={slot}
              onClick={
                slot.taskId
                  ? () => navigate(`/agents/${slot.taskId}`)
                  : undefined
              }
            />
          </Grid>
        ))}
      </Grid>

      {recentTasks.length > 0 && (
        <>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Recent Tasks
          </Typography>
          <Stack spacing={1}>
            {recentTasks.map((task) => (
              <Paper
                key={task.id}
                sx={{
                  px: 2,
                  py: 1.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {task.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {task.id}
                  </Typography>
                </Box>
                <Chip
                  label={task.status}
                  size="small"
                  color={
                    task.status === "completed"
                      ? "success"
                      : task.status === "failed" || task.status === "escalated"
                        ? "error"
                        : task.status === "implementing" ||
                            task.status === "validating"
                          ? "info"
                          : "default"
                  }
                  sx={{ fontWeight: 600, fontSize: 11 }}
                />
              </Paper>
            ))}
          </Stack>
        </>
      )}

      <Fab
        color="secondary"
        onClick={openTaskDialog}
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
        }}
        aria-label="New Task"
      >
        <AddIcon />
      </Fab>
    </Box>
  );
}
