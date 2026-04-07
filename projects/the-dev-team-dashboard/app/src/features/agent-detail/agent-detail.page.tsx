import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
  Skeleton,
  Alert,
} from "@mui/material";
import { useApi, useSocket } from "../api-client";
import type {
  AgentMessage,
  AgentMessageType,
  SessionTranscript,
} from "../shared";

const MESSAGE_COLORS: Record<AgentMessageType, string> = {
  text: "#e0e0e0",
  tool_use: "#ffb74d",
  tool_result: "#81c784",
  error: "#ef5350",
  status: "#4dd0e1",
};

const MESSAGE_LABELS: Record<AgentMessageType, string> = {
  text: "Text",
  tool_use: "Tool Use",
  tool_result: "Tool Result",
  error: "Error",
  status: "Status",
};

/** Map transcript event types to agent message types */
function mapEventType(type: string): AgentMessageType {
  switch (type) {
    case "tool_call":
      return "tool_use";
    case "tool_result":
      return "tool_result";
    case "error":
    case "task_failed":
      return "error";
    case "task_created":
    case "task_started":
    case "task_completed":
    case "gate_check":
      return "status";
    case "agent_message":
    default:
      return "text";
  }
}

let idCounter = 0;

export default function AgentDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [filters, setFilters] = useState<AgentMessageType[]>([
    "text",
    "tool_use",
    "tool_result",
    "error",
    "status",
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const api = useApi();
  const socket = useSocket();

  const fetchMessages = useCallback(async () => {
    if (!taskId || taskId === "live") {
      // For "live" mode, just start with empty messages and rely on WebSocket
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Try to load historical transcript data from session history
      const transcripts = await api
        .get<SessionTranscript[]>(`/history/sessions/${taskId}`)
        .catch(() => null);

      if (transcripts && transcripts.length > 0) {
        // Flatten all events from all role transcripts into AgentMessage format
        const historicalMessages: AgentMessage[] = [];
        for (const transcript of transcripts) {
          for (const event of transcript.events) {
            historicalMessages.push({
              id: event.taskId + "-" + (idCounter++),
              taskId: event.taskId || taskId,
              slotId: 0,
              type: mapEventType(event.type),
              role: event.role || transcript.role,
              content: typeof event.content === "string"
                ? event.content
                : JSON.stringify(event.content),
              timestamp: event.timestamp,
              toolName: event.type === "tool_call" ? "tool" : undefined,
            });
          }
        }
        // Sort by timestamp
        historicalMessages.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        setMessages(historicalMessages);
      } else {
        // No historical data found
        setMessages([]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load messages",
      );
    } finally {
      setLoading(false);
    }
  }, [api, taskId]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg: AgentMessage) => {
      if (taskId && taskId !== "live" && msg.taskId !== taskId) return;
      setMessages((prev) => [...prev, msg]);
    };

    socket.on("agent:message", handleMessage);
    return () => {
      socket.off("agent:message", handleMessage);
    };
  }, [socket, taskId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFilterChange = (
    _: React.MouseEvent<HTMLElement>,
    newFilters: AgentMessageType[],
  ) => {
    if (newFilters.length > 0) {
      setFilters(newFilters);
    }
  };

  const filteredMessages = messages.filter((m) => filters.includes(m.type));

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={500} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>
        Agent Detail
      </Typography>
      {taskId && taskId !== "live" && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Task: {taskId}
        </Typography>
      )}

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error} - Waiting for live messages
        </Alert>
      )}

      <ToggleButtonGroup
        value={filters}
        onChange={handleFilterChange}
        size="small"
        sx={{ mb: 2, flexWrap: "wrap" }}
      >
        {(Object.keys(MESSAGE_LABELS) as AgentMessageType[]).map((type) => (
          <ToggleButton
            key={type}
            value={type}
            sx={{
              fontSize: 12,
              px: 1.5,
              color: MESSAGE_COLORS[type],
              "&.Mui-selected": {
                color: MESSAGE_COLORS[type],
                backgroundColor: `${MESSAGE_COLORS[type]}20`,
              },
            }}
          >
            {MESSAGE_LABELS[type]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Paper
        ref={scrollRef}
        sx={{
          backgroundColor: "#0a0a0a",
          p: 2,
          height: "calc(100vh - 280px)",
          overflowY: "auto",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 13,
          lineHeight: 1.6,
          border: "1px solid rgba(255,255,255,0.06)",
          "&::-webkit-scrollbar": {
            width: 6,
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "rgba(255,255,255,0.15)",
            borderRadius: 3,
          },
        }}
      >
        {filteredMessages.length === 0 ? (
          <Typography
            sx={{
              color: "text.secondary",
              fontFamily: "monospace",
              textAlign: "center",
              py: 8,
            }}
          >
            {!taskId || taskId === "live"
              ? "No active agent session. Select an active agent slot from the Overview to view live output."
              : messages.length === 0
                ? "No messages yet. Waiting for agent activity..."
                : "No messages match the current filters."}
          </Typography>
        ) : (
          filteredMessages.map((msg) => (
            <Box
              key={msg.id}
              sx={{
                mb: 0.5,
                py: 0.5,
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                "&:hover": {
                  backgroundColor: "rgba(255,255,255,0.02)",
                },
              }}
            >
              <Box
                component="span"
                sx={{ color: "text.secondary", mr: 1, fontSize: 11 }}
              >
                [{formatTimestamp(msg.timestamp)}]
              </Box>
              <Box
                component="span"
                sx={{
                  color: MESSAGE_COLORS[msg.type],
                  fontWeight: 600,
                  mr: 1,
                  fontSize: 11,
                  textTransform: "uppercase",
                }}
              >
                [{msg.type}]
              </Box>
              {msg.role && (
                <Box
                  component="span"
                  sx={{ color: "#b39ddb", mr: 1, fontSize: 12 }}
                >
                  {msg.role}:
                </Box>
              )}
              {msg.toolName && (
                <Box
                  component="span"
                  sx={{
                    color: "#ffcc80",
                    mr: 1,
                    fontSize: 12,
                    fontStyle: "italic",
                  }}
                >
                  {msg.toolName}
                </Box>
              )}
              <Box component="span" sx={{ color: MESSAGE_COLORS[msg.type] }}>
                {msg.content}
              </Box>
            </Box>
          ))
        )}
      </Paper>
    </Box>
  );
}
