import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Typography,
  Grid2 as Grid,
  Paper,
  Skeleton,
  Alert,
} from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { useApi } from "../api-client";
import type { HistoryTask } from "../shared";

/** Compute duration in ms from startedAt/completedAt if duration is not provided */
function getTaskDuration(task: HistoryTask): number | undefined {
  if (task.duration !== undefined) return task.duration;
  if (task.startedAt && task.completedAt) {
    return new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime();
  }
  return undefined;
}

function groupByDate(tasks: HistoryTask[]) {
  const map = new Map<string, { completed: number; failed: number }>();
  for (const task of tasks) {
    const date = new Date(task.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const entry = map.get(date) || { completed: 0, failed: 0 };
    if (task.status === "completed") entry.completed++;
    else if (task.status === "failed" || task.status === "escalated")
      entry.failed++;
    map.set(date, entry);
  }
  return map;
}

export default function Metrics() {
  const [tasks, setTasks] = useState<HistoryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<HistoryTask[]>("/history/tasks");
      setTasks(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load metrics",
      );
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const dailyData = useMemo(() => {
    const grouped = groupByDate(tasks);
    const dates = Array.from(grouped.keys());
    const completed = dates.map((d) => grouped.get(d)!.completed);
    const failed = dates.map((d) => grouped.get(d)!.failed);
    return { dates, completed, failed };
  }, [tasks]);

  const costTrend = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const task of tasks) {
      if (task.cost === undefined || task.cost === null) continue;
      const date = new Date(task.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      grouped.set(date, (grouped.get(date) || 0) + task.cost);
    }
    const dates = Array.from(grouped.keys());
    const costs = dates.map((d) => grouped.get(d)!);
    return { dates, costs };
  }, [tasks]);

  const durationTrend = useMemo(() => {
    const grouped = new Map<string, { total: number; count: number }>();
    for (const task of tasks) {
      const duration = getTaskDuration(task);
      if (duration === undefined || duration <= 0) continue;
      const date = new Date(task.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const entry = grouped.get(date) || { total: 0, count: 0 };
      entry.total += duration;
      entry.count++;
      grouped.set(date, entry);
    }
    const dates = Array.from(grouped.keys());
    const avgDurations = dates.map((d) => {
      const entry = grouped.get(d)!;
      return Math.round(entry.total / entry.count / 1000 / 60); // minutes
    });
    return { dates, avgDurations };
  }, [tasks]);

  const successRate = useMemo(() => {
    const completed = tasks.filter((t) => t.status === "completed").length;
    const failed = tasks.filter(
      (t) => t.status === "failed" || t.status === "escalated",
    ).length;
    const other = tasks.length - completed - failed;
    return [
      { id: 0, value: completed, label: "Completed", color: "#4caf50" },
      { id: 1, value: failed, label: "Failed", color: "#f44336" },
      { id: 2, value: other, label: "Other", color: "#9e9e9e" },
    ].filter((d) => d.value > 0);
  }, [tasks]);

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 3 }} />
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((i) => (
            <Grid key={i} size={{ xs: 12, md: 6 }}>
              <Skeleton variant="rounded" height={320} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Metrics
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {tasks.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: "center" }}>
          <Typography variant="h6" color="text.secondary">
            No data available yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Metrics will populate as tasks are completed.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {/* Tasks per day */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontSize: 16 }}>
                Tasks Per Day
              </Typography>
              {dailyData.dates.length > 0 ? (
                <BarChart
                  xAxis={[{ scaleType: "band", data: dailyData.dates }]}
                  series={[
                    {
                      data: dailyData.completed,
                      label: "Completed",
                      color: "#4caf50",
                    },
                    {
                      data: dailyData.failed,
                      label: "Failed",
                      color: "#f44336",
                    },
                  ]}
                  height={280}
                />
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 8, textAlign: "center" }}
                >
                  No daily data
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Cost trend */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontSize: 16 }}>
                Cost Trend
              </Typography>
              {costTrend.dates.length > 0 ? (
                <LineChart
                  xAxis={[{ scaleType: "point", data: costTrend.dates }]}
                  series={[
                    {
                      data: costTrend.costs,
                      label: "Cost ($)",
                      color: "#ff9800",
                      area: true,
                    },
                  ]}
                  height={280}
                />
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 8, textAlign: "center" }}
                >
                  No cost data
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Average duration */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontSize: 16 }}>
                Average Duration (minutes)
              </Typography>
              {durationTrend.dates.length > 0 ? (
                <LineChart
                  xAxis={[{ scaleType: "point", data: durationTrend.dates }]}
                  series={[
                    {
                      data: durationTrend.avgDurations,
                      label: "Avg Duration (min)",
                      color: "#00bcd4",
                      area: true,
                    },
                  ]}
                  height={280}
                />
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 8, textAlign: "center" }}
                >
                  No duration data
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Success rate */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontSize: 16 }}>
                Success Rate
              </Typography>
              {successRate.length > 0 ? (
                <PieChart
                  series={[
                    {
                      data: successRate,
                      innerRadius: 50,
                      outerRadius: 100,
                      paddingAngle: 2,
                      cornerRadius: 4,
                    },
                  ]}
                  height={280}
                />
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 8, textAlign: "center" }}
                >
                  No status data
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
