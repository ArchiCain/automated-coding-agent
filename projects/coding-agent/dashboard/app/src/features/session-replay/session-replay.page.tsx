import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Slider,
  Chip,
  Skeleton,
  Alert,
  IconButton,
  Collapse,
  Stack,
  Button,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useApi } from "../api-client";
import type {
  TranscriptEvent,
  TranscriptEventType,
  SessionTranscript,
} from "../shared";

const eventColors: Record<TranscriptEventType, string> = {
  task_created: "#90caf9",
  task_started: "#4dd0e1",
  agent_message: "#e0e0e0",
  tool_call: "#ffb74d",
  tool_result: "#81c784",
  gate_check: "#ce93d8",
  task_completed: "#66bb6a",
  task_failed: "#ef5350",
  error: "#f44336",
};

const eventIcons: Record<TranscriptEventType, string> = {
  task_created: "NEW",
  task_started: "START",
  agent_message: "MSG",
  tool_call: "TOOL",
  tool_result: "RES",
  gate_check: "GATE",
  task_completed: "DONE",
  task_failed: "FAIL",
  error: "ERR",
};

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Check if a type string is a known TranscriptEventType */
function isKnownEventType(type: string): type is TranscriptEventType {
  return type in eventColors;
}

let idCounter = 0;

export default function SessionReplay() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [events, setEvents] = useState<TranscriptEvent[]>([]);
  const [sliderValue, setSliderValue] = useState(100);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();

  const fetchTranscript = useCallback(async () => {
    if (!taskId) return;
    try {
      setLoading(true);

      // The API returns an array of SessionTranscript objects (one per role).
      // Each contains role, sessionId, eventCount, and events[].
      // We need to flatten all events and sort by timestamp.
      const data = await api.get<SessionTranscript[] | TranscriptEvent[]>(
        `/history/sessions/${taskId}`,
      );

      let flatEvents: TranscriptEvent[];

      if (Array.isArray(data) && data.length > 0) {
        const first = data[0] as unknown as Record<string, unknown>;
        // Detect the response shape: SessionTranscript has "events" array
        if (first && "events" in first && Array.isArray(first.events)) {
          // Nested format: array of { role, sessionId, eventCount, events }
          flatEvents = [];
          for (const transcript of data as SessionTranscript[]) {
            for (const event of transcript.events) {
              flatEvents.push({
                // Ensure each event has an id
                id: event.id || `${transcript.role}-${idCounter++}`,
                taskId: event.taskId || taskId,
                type: isKnownEventType(event.type) ? event.type : "agent_message",
                role: event.role || transcript.role,
                content: typeof event.content === "string"
                  ? event.content
                  : JSON.stringify(event.content),
                timestamp: event.timestamp,
                metadata: event.metadata,
              });
            }
          }
        } else {
          // Already a flat array of TranscriptEvent
          flatEvents = (data as TranscriptEvent[]).map((event) => ({
            ...event,
            id: event.id || `evt-${idCounter++}`,
          }));
        }
      } else {
        flatEvents = [];
      }

      // Sort events by timestamp
      flatEvents.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      setEvents(flatEvents);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load session",
      );
    } finally {
      setLoading(false);
    }
  }, [api, taskId]);

  useEffect(() => {
    void fetchTranscript();
  }, [fetchTranscript]);

  const toggleExpand = (id: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const visibleCount = Math.ceil((sliderValue / 100) * events.length);
  const visibleEvents = events.slice(0, visibleCount);

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={500} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/history")}
          size="small"
        >
          Back
        </Button>
      </Box>

      <Typography variant="h4" sx={{ mb: 1 }}>
        Session Replay
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Task: {taskId} -- {events.length} events
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {events.length > 0 && (
        <Paper sx={{ px: 3, py: 2, mb: 3 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Timeline Scrubber
          </Typography>
          <Slider
            value={sliderValue}
            onChange={(_, val) => setSliderValue(val as number)}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) =>
              `${Math.ceil((v / 100) * events.length)} / ${events.length}`
            }
            sx={{ color: "secondary.main" }}
          />
        </Paper>
      )}

      <Stack spacing={0}>
        {visibleEvents.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: "center" }}>
            <Typography variant="h6" color="text.secondary">
              No events to display
            </Typography>
          </Paper>
        ) : (
          visibleEvents.map((event, index) => {
            const isExpanded = expandedEvents.has(event.id);
            const isLast = index === visibleEvents.length - 1;
            const typeColor =
              isKnownEventType(event.type)
                ? eventColors[event.type]
                : "#e0e0e0";
            const typeIcon =
              isKnownEventType(event.type)
                ? eventIcons[event.type]
                : "EVT";

            return (
              <Box key={event.id} sx={{ display: "flex" }}>
                {/* Timeline line */}
                <Box
                  sx={{
                    width: 40,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      backgroundColor: typeColor,
                      boxShadow: `0 0 8px ${typeColor}60`,
                      flexShrink: 0,
                      mt: 1.5,
                    }}
                  />
                  {!isLast && (
                    <Box
                      sx={{
                        width: 2,
                        flex: 1,
                        backgroundColor: "rgba(255,255,255,0.08)",
                      }}
                    />
                  )}
                </Box>

                {/* Event content */}
                <Paper
                  sx={{
                    flex: 1,
                    mb: 1,
                    p: 1.5,
                    ml: 1,
                    cursor: "pointer",
                    transition: "background-color 0.15s",
                    "&:hover": {
                      backgroundColor: "rgba(255,255,255,0.03)",
                    },
                  }}
                  onClick={() => toggleExpand(event.id)}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 1 }}
                    >
                      <Chip
                        label={typeIcon}
                        size="small"
                        sx={{
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: "monospace",
                          height: 22,
                          backgroundColor: `${typeColor}20`,
                          color: typeColor,
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{ fontFamily: "monospace", color: "text.secondary" }}
                      >
                        {formatTimestamp(event.timestamp)}
                      </Typography>
                      {event.role && (
                        <Chip
                          label={event.role}
                          variant="outlined"
                          size="small"
                          sx={{ fontSize: 10, height: 20 }}
                        />
                      )}
                    </Box>
                    <IconButton size="small">
                      {isExpanded ? (
                        <ExpandLessIcon sx={{ fontSize: 18 }} />
                      ) : (
                        <ExpandMoreIcon sx={{ fontSize: 18 }} />
                      )}
                    </IconButton>
                  </Box>

                  <Typography
                    variant="body2"
                    sx={{
                      mt: 0.5,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: isExpanded ? "pre-wrap" : "nowrap",
                      fontFamily: "monospace",
                      fontSize: 12,
                      color: typeColor,
                    }}
                  >
                    {isExpanded
                      ? event.content
                      : event.content.substring(0, 120) +
                        (event.content.length > 120 ? "..." : "")}
                  </Typography>

                  <Collapse in={isExpanded}>
                    {event.metadata &&
                      Object.keys(event.metadata).length > 0 && (
                        <Paper
                          sx={{
                            mt: 1,
                            p: 1.5,
                            backgroundColor: "rgba(0,0,0,0.3)",
                          }}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            gutterBottom
                          >
                            Metadata
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: "monospace",
                              fontSize: 11,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-all",
                            }}
                          >
                            {JSON.stringify(event.metadata, null, 2)}
                          </Typography>
                        </Paper>
                      )}
                  </Collapse>
                </Paper>
              </Box>
            );
          })
        )}
      </Stack>
    </Box>
  );
}
