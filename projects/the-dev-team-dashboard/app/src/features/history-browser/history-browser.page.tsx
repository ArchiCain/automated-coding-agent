import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Skeleton,
  Alert,
  InputAdornment,
  Stack,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useApi } from "../api-client";
import type { HistoryTask, TaskStatus } from "../shared";

const STATUS_OPTIONS: (TaskStatus | "all")[] = [
  "all",
  "queued",
  "assigned",
  "setting_up",
  "implementing",
  "validating",
  "submitting",
  "completed",
  "failed",
  "escalated",
];

const statusChipColor: Record<
  string,
  "success" | "error" | "default" | "info" | "warning"
> = {
  completed: "success",
  failed: "error",
  escalated: "error",
  queued: "default",
  assigned: "info",
  setting_up: "info",
  implementing: "warning",
  validating: "info",
  submitting: "info",
};

function formatDuration(ms?: number): string {
  if (ms === undefined) return "--";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function computeDuration(task: HistoryTask): number | undefined {
  if (task.duration !== undefined) return task.duration;
  if (task.startedAt && task.completedAt) {
    return (
      new Date(task.completedAt).getTime() -
      new Date(task.startedAt).getTime()
    );
  }
  return undefined;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryBrowser() {
  const [tasks, setTasks] = useState<HistoryTask[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();
  const navigate = useNavigate();

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<HistoryTask[]>("/history/tasks");
      setTasks(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load history",
      );
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const handleStatusChange = (event: SelectChangeEvent<string>) => {
    setStatusFilter(event.target.value as TaskStatus | "all");
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      search === "" ||
      task.title.toLowerCase().includes(search.toLowerCase()) ||
      task.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={60} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={400} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        History
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          placeholder="Search tasks..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 20 }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ flex: 1, maxWidth: 400 }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={handleStatusChange}
          >
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s} value={s}>
                {s === "all" ? "All Statuses" : s.replace("_", " ")}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {filteredTasks.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: "center" }}>
          <Typography variant="h6" color="text.secondary">
            {tasks.length === 0
              ? "No task history yet"
              : "No tasks match the current filters"}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Task ID</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell align="right">Cost</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTasks.map((task) => (
                <TableRow
                  key={task.id}
                  hover
                  onClick={() => navigate(`/history/${task.id}`)}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: 13 }}>
                      {formatDate(task.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: "monospace", fontSize: 12 }}
                    >
                      {task.id.substring(0, 8)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {task.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={task.status.replace("_", " ")}
                      color={statusChipColor[task.status] || "default"}
                      size="small"
                      sx={{ fontSize: 11, fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: "monospace", fontSize: 13 }}
                    >
                      {formatDuration(computeDuration(task))}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: "monospace", fontSize: 13 }}
                    >
                      {task.cost !== undefined && task.cost !== null
                        ? `$${task.cost.toFixed(4)}`
                        : "--"}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
