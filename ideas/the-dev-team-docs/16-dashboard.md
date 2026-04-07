# 16 — Dashboard

## Goal

Build a real-time web dashboard that shows the state of THE Dev Team — active agents, task progress, environment health, PR pipeline, and searchable history. Built with React (consistent with the main application frontend).

## Current State

- The coding-agent has an Angular 21 frontend (`projects/coding-agent/frontend/`) — being removed
- The application has a React 19 + Material-UI frontend (`projects/application/frontend/`)
- The coding-agent backend has WebSocket gateways for real-time streaming
- Session, environment, and agent state are tracked in backend services

## Target State

A React dashboard (new project or integrated into the main app) with these views:

1. **Overview** — All active agents, current task, current gate, progress
2. **Agent Detail** — Live streaming of agent work via WebSocket
3. **Task Board** — Kanban of all tasks (queued → in progress → validating → completed → failed)
4. **Environment Map** — Active K8s namespaces with health, resources, ingress URLs
5. **PR Pipeline** — Open PRs, CI status, review status
6. **History Browser** — Searchable archive of past tasks
7. **Session Replay** — Step through a session transcript chronologically
8. **Metrics** — Success rates, time per task, cost trends

## Implementation Steps

### Step 1: Decide on Project Structure

Two options:

**Option A: Separate project** — `projects/the-dev-team-dashboard/`
- Clean separation
- Independent deployment
- Different release cycle from the main app

**Option B: Integrated into main app** — New feature module in `projects/application/frontend/`
- Shared auth (Keycloak)
- Shared UI components (MUI theme)
- Single deployment

Recommendation: **Option A** for now. The dashboard doesn't need Keycloak auth (it's an internal tool), and keeping it separate avoids coupling. Can merge later if needed.

### Step 2: Scaffold React Project

```bash
mkdir -p projects/the-dev-team-dashboard
cd projects/the-dev-team-dashboard
npm create vite@latest . -- --template react-ts
npm install @mui/material @emotion/react @emotion/styled socket.io-client axios react-router-dom
```

### Step 3: Create WebSocket Gateway on Backend

The orchestrator (Plan 04) needs WebSocket endpoints for real-time updates.

Create `src/gateway/dashboard.gateway.ts`:

```typescript
@WebSocketGateway({
  namespace: '/dashboard',
  cors: { origin: '*' },
})
export class DashboardGateway {
  @WebSocketServer()
  server: Server;

  // Emit agent progress events
  emitAgentProgress(taskId: string, role: string, message: AgentMessage): void {
    this.server.emit('agent:progress', { taskId, role, message });
  }

  // Emit task status changes
  emitTaskUpdate(task: Task): void {
    this.server.emit('task:update', task);
  }

  // Emit environment health
  emitEnvironmentHealth(taskId: string, health: HealthResult): void {
    this.server.emit('env:health', { taskId, health });
  }

  // Emit gate results
  emitGateResult(taskId: string, result: GateResult): void {
    this.server.emit('gate:result', { taskId, result });
  }
}
```

### Step 4: Build Overview Page

The overview page shows all agent slots and their current state:

```typescript
// components/Overview.tsx
function Overview() {
  const [agents, setAgents] = useState<AgentSlot[]>([]);

  useEffect(() => {
    const socket = io('/dashboard');
    socket.on('agent:progress', (data) => {
      // Update agent state
    });
    socket.on('task:update', (data) => {
      // Update task state
    });
    return () => socket.disconnect();
  }, []);

  return (
    <Grid container spacing={2}>
      {agents.map(agent => (
        <Grid item xs={12} md={6} lg={3} key={agent.id}>
          <AgentCard agent={agent} />
        </Grid>
      ))}
    </Grid>
  );
}
```

### Step 5: Build Task Board

Kanban-style view with columns for each status:

```typescript
const columns: TaskStatus[] = ['queued', 'assigned', 'implementing', 'validating', 'completed', 'failed'];

function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);

  return (
    <Box sx={{ display: 'flex', gap: 2, overflow: 'auto' }}>
      {columns.map(status => (
        <Box key={status} sx={{ minWidth: 280, flex: '0 0 280px' }}>
          <Typography variant="h6">{status}</Typography>
          {tasks
            .filter(t => t.status === status)
            .map(task => <TaskCard key={task.id} task={task} />)
          }
        </Box>
      ))}
    </Box>
  );
}
```

### Step 6: Build Agent Detail View

Live streaming of agent work — terminal-style output:

```typescript
function AgentDetail({ taskId }: { taskId: string }) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);

  useEffect(() => {
    const socket = io('/dashboard');
    socket.on('agent:progress', (data) => {
      if (data.taskId === taskId) {
        setMessages(prev => [...prev, data.message]);
      }
    });
    return () => socket.disconnect();
  }, [taskId]);

  return (
    <Box sx={{ fontFamily: 'monospace', bgcolor: '#1e1e1e', color: '#d4d4d4', p: 2, overflow: 'auto' }}>
      {messages.map((msg, i) => (
        <Box key={i} sx={{ mb: 0.5 }}>
          <span style={{ color: getTypeColor(msg.type) }}>[{msg.type}]</span>{' '}
          {msg.content}
        </Box>
      ))}
    </Box>
  );
}
```

### Step 7: Build History Browser

Searchable archive that reads from the orchestrator's history API:

```typescript
// Backend endpoint
@Controller('api/history')
export class HistoryController {
  @Get('tasks')
  async searchTasks(@Query('q') query: string, @Query('status') status: string) {
    // Read from index.jsonl and filter
  }

  @Get('tasks/:id')
  async getTaskSummary(@Param('id') id: string) {
    // Read task summary markdown
  }

  @Get('sessions/:taskId')
  async getSessionTranscripts(@Param('taskId') taskId: string) {
    // List session JSONL files for a task
  }

  @Get('sessions/:taskId/:filename')
  async getTranscript(@Param('taskId') taskId: string, @Param('filename') filename: string) {
    // Stream JSONL file
  }
}
```

### Step 8: Build Session Replay

Step through a JSONL transcript chronologically:

```typescript
function SessionReplay({ transcript }: { transcript: TranscriptEvent[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <Box>
      <Slider
        value={currentIndex}
        max={transcript.length - 1}
        onChange={(_, v) => setCurrentIndex(v as number)}
      />
      <Timeline>
        {transcript.slice(0, currentIndex + 1).map((event, i) => (
          <TimelineItem key={i}>
            <TimelineContent>
              <Typography variant="caption">{event.ts}</Typography>
              <Typography>{event.type}: {event.content?.substring(0, 200)}</Typography>
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </Box>
  );
}
```

### Step 9: Build Metrics View

Historical charts showing:
- Tasks per day (completed vs failed)
- Average cost per task
- Average time per task
- Most common failure modes
- Cost trend over time

Use a lightweight charting library (recharts or chart.js).

### Step 10: Docker Build + Deploy

Add the dashboard to the build pipeline:

```yaml
# Taskfile
build:dashboard:
  desc: Build THE Dev Team dashboard Docker image
  cmds:
    - docker build -t localhost:30500/the-dev-team-dashboard:latest projects/the-dev-team-dashboard/
    - docker push localhost:30500/the-dev-team-dashboard:latest
```

Deploy alongside the orchestrator in the `the-dev-team` namespace.

## Verification

- [ ] Dashboard project builds and serves
- [ ] WebSocket connection established to orchestrator
- [ ] Overview shows agent slots with real-time status
- [ ] Task board displays tasks in correct columns
- [ ] Agent detail streams messages in real-time
- [ ] History browser can search and display past tasks
- [ ] Session replay steps through transcripts
- [ ] Metrics page shows charts with historical data
- [ ] Dashboard is accessible at `dashboard.the-dev-team.localhost`

## Open Questions

- **Auth for dashboard:** Internal tool — does it need auth? If exposed on Tailscale, it's already network-restricted. If exposed publicly, add basic auth or integrate with Keycloak.
- **Charting library:** Recharts is lightweight and React-native. Chart.js has more features. MUI has basic charting in `@mui/x-charts`. Choose one.
- **Session replay UX:** JSONL files can have thousands of events. Need pagination, filtering by event type, and search within a transcript.
- **Priority vs effort:** The dashboard is Phase 3. Most of the orchestrator's value comes from the execution loop, not the UI. The CLI (Taskfile commands) and history files provide immediate visibility. Build the dashboard when the core system is stable.
