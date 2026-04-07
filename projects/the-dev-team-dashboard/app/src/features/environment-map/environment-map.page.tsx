import { useState, useEffect, useCallback } from "react";
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
  Button,
  Chip,
  Skeleton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Link,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useApi } from "../api-client";
import type { Environment } from "../shared";

const podStatusColors: Record<string, string> = {
  running: "#4caf50",
  pending: "#ff9800",
  failed: "#f44336",
  terminating: "#9e9e9e",
};

const healthChipColor: Record<
  string,
  "success" | "error" | "default"
> = {
  healthy: "success",
  unhealthy: "error",
  unknown: "default",
};

export default function EnvironmentMap() {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const api = useApi();

  const fetchEnvironments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<Environment[]>("/environments");
      setEnvironments(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load environments",
      );
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void fetchEnvironments();
  }, [fetchEnvironments]);

  const handleDestroy = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await api.del(`/environments/${deleteTarget}`);
      setEnvironments((prev) =>
        prev.filter((e) => e.taskId !== deleteTarget),
      );
      setDeleteTarget(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to destroy environment",
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={400} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Environments
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {environments.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: "center" }}>
          <Typography variant="h6" color="text.secondary">
            No active environments
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Environments are created automatically when agents start working on
            tasks.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Namespace</TableCell>
                <TableCell>Pod Status</TableCell>
                <TableCell>Health</TableCell>
                <TableCell>Age</TableCell>
                <TableCell>Ingress URLs</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {environments.map((env) => (
                <TableRow
                  key={env.taskId}
                  sx={{
                    "&:hover": {
                      backgroundColor: "rgba(255,255,255,0.02)",
                    },
                  }}
                >
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: "monospace", fontWeight: 500 }}
                    >
                      {env.namespace}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {env.taskId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 1 }}
                    >
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor:
                            podStatusColors[env.podStatus] || "#9e9e9e",
                          boxShadow: `0 0 6px ${podStatusColors[env.podStatus] || "#9e9e9e"}80`,
                        }}
                      />
                      <Typography variant="body2" sx={{ textTransform: "capitalize" }}>
                        {env.podStatus}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={env.healthStatus}
                      color={healthChipColor[env.healthStatus] || "default"}
                      size="small"
                      sx={{ fontSize: 11 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                      {env.age}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {env.ingressUrls.length > 0 ? (
                      env.ingressUrls.map((url) => (
                        <Link
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener"
                          sx={{
                            display: "block",
                            fontSize: 12,
                            fontFamily: "monospace",
                          }}
                        >
                          {url}
                        </Link>
                      ))
                    ) : (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        None
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => setDeleteTarget(env.taskId)}
                      sx={{ fontSize: 12 }}
                    >
                      Destroy
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Destroy Environment</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to destroy the environment for task{" "}
            <strong>{deleteTarget}</strong>? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDestroy}
            color="error"
            variant="contained"
            disabled={deleting}
          >
            {deleting ? "Destroying..." : "Destroy"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
