import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Alert,
  Snackbar,
  Box,
  CircularProgress,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { useApi } from "../api-client";

const PRIORITY_OPTIONS = [
  { label: "Low", value: 3 },
  { label: "Normal", value: 5 },
  { label: "High", value: 8 },
  { label: "Critical", value: 10 },
] as const;

interface TaskSubmissionDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface TaskSubmissionResponse {
  id: string;
}

export default function TaskSubmissionDialog({
  open,
  onClose,
  onSuccess,
}: TaskSubmissionDialogProps) {
  const api = useApi();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [touchesFrontend, setTouchesFrontend] = useState(false);
  const [priority, setPriority] = useState<number>(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTaskId, setSuccessTaskId] = useState<string | null>(null);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setTouchesFrontend(false);
    setPriority(5);
    setError(null);
  };

  const handleClose = () => {
    if (!submitting) {
      resetForm();
      onClose();
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      const result = await api.post<TaskSubmissionResponse>("/tasks", {
        title: title.trim(),
        description: description.trim(),
        source: "manual",
        touchesFrontend,
        priority,
      });
      setSuccessTaskId(result.id);
      resetForm();
      onClose();
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit task",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handlePriorityChange = (event: SelectChangeEvent<number>) => {
    setPriority(event.target.value as number);
  };

  const isValid = title.trim().length > 0 && description.trim().length > 0;

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundImage: "none",
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>New Task</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              fullWidth
              autoFocus
              disabled={submitting}
              placeholder="Brief summary of the task"
            />

            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              fullWidth
              multiline
              rows={4}
              disabled={submitting}
              placeholder="Detailed description of what needs to be done"
            />

            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priority}
                label="Priority"
                onChange={handlePriorityChange}
                disabled={submitting}
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={touchesFrontend}
                  onChange={(e) => setTouchesFrontend(e.target.checked)}
                  disabled={submitting}
                  color="secondary"
                />
              }
              label="Touches Frontend"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!isValid || submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : undefined}
            sx={{
              background: "linear-gradient(135deg, #534bae 0%, #4ebaaa 100%)",
              "&:hover": {
                background: "linear-gradient(135deg, #3f37a1 0%, #3da898 100%)",
              },
            }}
          >
            {submitting ? "Submitting..." : "Submit Task"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!successTaskId}
        autoHideDuration={5000}
        onClose={() => setSuccessTaskId(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSuccessTaskId(null)}
          severity="success"
          variant="filled"
          sx={{ width: "100%" }}
        >
          Task created successfully — ID: {successTaskId}
        </Alert>
      </Snackbar>
    </>
  );
}
