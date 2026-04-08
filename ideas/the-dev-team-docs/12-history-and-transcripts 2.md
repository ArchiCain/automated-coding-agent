# 12 — History & Transcripts

## Goal

Record every action THE Dev Team takes — full session transcripts (JSONL), human-readable task summaries (markdown), and orchestrator event logs. Sync to a protected git branch for persistence and auditability.

## Current State

- The coding-agent backend tracks sessions in `session.service.ts` with in-memory state
- Session data is stored in `.coding-agent-data/agents/{agent-id}/sessions/`
- No JSONL transcript format
- No task summaries
- No history sync mechanism

## Target State

```
.the-dev-team/history/
├── sessions/              ← Raw JSONL transcripts (one per role per task)
│   └── 2026/04/01/
│       ├── task-abc123-architect-{ts}.jsonl
│       ├── task-abc123-implementer-{ts}.jsonl
│       └── ...
├── tasks/                 ← Markdown task summaries
│   └── 2026/04/
│       └── task-abc123-user-profile.md
├── orchestrator/          ← System-level event log
│   └── 2026/04/01.jsonl
└── index.jsonl            ← Fast lookup index (one line per task)
```

## Implementation Steps

### Step 1: Create Transcript Writer Service

Create `src/history/transcript-writer.service.ts`:

```typescript
@Injectable()
export class TranscriptWriterService {
  private basePath = '.the-dev-team/history';

  async startSession(taskId: string, role: TaskRole, metadata: SessionMetadata): Promise<string> {
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date();
    const dir = path.join(
      this.basePath,
      'sessions',
      date.getFullYear().toString(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    );
    await fs.mkdir(dir, { recursive: true });

    const filename = `task-${taskId}-${role}-${timestamp}.jsonl`;
    const filepath = path.join(dir, filename);

    // Write session start event
    await this.appendLine(filepath, {
      ts: date.toISOString(),
      type: 'session_start',
      taskId,
      role,
      ...metadata,
    });

    return filepath;
  }

  async logMessage(transcriptPath: string, role: TaskRole, message: AgentMessage): Promise<void> {
    await this.appendLine(transcriptPath, {
      ts: new Date().toISOString(),
      type: message.type,
      role,
      content: message.content,
      // Don't log raw — it can be huge. Log selectively.
    });
  }

  async logEvent(taskId: string, event: Record<string, unknown>): Promise<void> {
    // Log to orchestrator event log
    const date = new Date();
    const dir = path.join(
      this.basePath,
      'orchestrator',
      date.getFullYear().toString(),
      String(date.getMonth() + 1).padStart(2, '0'),
    );
    await fs.mkdir(dir, { recursive: true });

    const filename = `${String(date.getDate()).padStart(2, '0')}.jsonl`;
    await this.appendLine(path.join(dir, filename), {
      ts: date.toISOString(),
      ...event,
    });
  }

  async endSession(transcriptPath: string, result: SessionResult): Promise<void> {
    await this.appendLine(transcriptPath, {
      ts: new Date().toISOString(),
      type: 'session_end',
      ...result,
    });
  }

  private async appendLine(filepath: string, data: Record<string, unknown>): Promise<void> {
    await fs.appendFile(filepath, JSON.stringify(data) + '\n');
  }
}
```

### Step 2: Create Task Summary Service

Create `src/history/task-summary.service.ts`:

```typescript
@Injectable()
export class TaskSummaryService {
  private basePath = '.the-dev-team/history';

  async generate(task: Task, roleResults: RoleResult[]): Promise<void> {
    const date = new Date();
    const dir = path.join(
      this.basePath,
      'tasks',
      date.getFullYear().toString(),
      String(date.getMonth() + 1).padStart(2, '0'),
    );
    await fs.mkdir(dir, { recursive: true });

    const slug = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
    const filename = `task-${task.id}-${slug}.md`;

    const summary = this.buildSummary(task, roleResults);
    await fs.writeFile(path.join(dir, filename), summary);

    // Append to index
    await this.appendToIndex(task, roleResults);
  }

  private buildSummary(task: Task, roleResults: RoleResult[]): string {
    const duration = task.completedAt
      ? Math.round((task.completedAt.getTime() - task.startedAt!.getTime()) / 60000)
      : 0;

    return `# Task: ${task.id} — ${task.title}

**Status**: ${task.status}
**Branch**: ${task.branch}
**PR**: ${task.prNumber ? `#${task.prNumber}` : 'N/A'}
**Duration**: ${duration} minutes
**Total Cost**: $${task.cost.toFixed(2)}

## Timeline

| Time | Role | Action | Duration | Cost |
|------|------|--------|----------|------|
${roleResults.map(r => `| ${r.startedAt} | ${r.role} | ${r.summary} | ${r.durationMin}m | $${r.cost.toFixed(2)} |`).join('\n')}

## Validation Gates

| Gate | Result | Attempts | Notes |
|------|--------|----------|-------|
${task.gateResults?.map(g => `| ${g.gate} | ${g.passed ? 'pass' : 'fail'} | ${g.attempt} | ${g.notes || ''} |`).join('\n') || 'N/A'}

## Files Changed
${task.changedFiles?.map(f => `- \`${f}\``).join('\n') || 'N/A'}

## Session Transcripts
${roleResults.map(r => `- [${r.role}](${r.transcriptPath})`).join('\n')}
`;
  }

  private async appendToIndex(task: Task, roleResults: RoleResult[]): Promise<void> {
    const indexPath = path.join(this.basePath, 'index.jsonl');
    const entry = {
      taskId: task.id,
      title: task.title,
      status: task.status,
      branch: task.branch,
      pr: task.prNumber ?? null,
      startedAt: task.startedAt?.toISOString(),
      completedAt: task.completedAt?.toISOString(),
      durationMs: task.completedAt && task.startedAt
        ? task.completedAt.getTime() - task.startedAt.getTime()
        : null,
      cost: task.cost,
      roles: roleResults.map(r => r.role),
      summaryPath: `tasks/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/task-${task.id}-${task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}.md`,
    };
    await fs.appendFile(indexPath, JSON.stringify(entry) + '\n');
  }
}
```

### Step 3: Create History Sync GitHub Action

Create `.github/workflows/sync-history.yml`:

```yaml
name: Sync Dev Team History

on:
  schedule:
    - cron: '*/15 * * * *'
  workflow_dispatch:
  repository_dispatch:
    types: [history-sync]

jobs:
  sync:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
        with:
          ref: the-dev-team/history
          fetch-depth: 0

      - name: Copy history from PVC
        run: |
          # The runner has access to the workspace PVC
          # Adjust path based on actual PVC mount location
          HISTORY_SRC="/workspace/.the-dev-team/history"
          if [ -d "$HISTORY_SRC" ]; then
            rsync -av "$HISTORY_SRC/" .the-dev-team/history/
          else
            echo "History source not found at $HISTORY_SRC"
            exit 0
          fi

      - name: Commit and push
        run: |
          git config user.name "THE Dev Team History Bot"
          git config user.email "the-dev-team-history@noreply"
          git add .the-dev-team/history/
          git diff --cached --quiet || \
            git commit -m "sync: history update $(date -u +%Y-%m-%dT%H:%M:%SZ)"
          git push origin the-dev-team/history
```

### Step 4: Create History Directory Initialization

On orchestrator startup, ensure the history directory structure exists:

```typescript
@Injectable()
export class HistoryInitService implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    const dirs = [
      '.the-dev-team/history/sessions',
      '.the-dev-team/history/tasks',
      '.the-dev-team/history/orchestrator',
    ];
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
    // Ensure index.jsonl exists
    const indexPath = '.the-dev-team/history/index.jsonl';
    try {
      await fs.access(indexPath);
    } catch {
      await fs.writeFile(indexPath, '');
    }
  }
}
```

### Step 5: Add Retention Cleanup

The scheduler (Plan 04) runs periodic cleanup:

```typescript
@Cron('0 3 * * *')  // Daily at 3 AM
async cleanupOldTranscripts(): Promise<void> {
  const retentionDays = 90;
  // Use the history:cleanup task
  await this.taskfile.run('history:cleanup', String(retentionDays));
}
```

## Verification

- [ ] Session transcripts are written as JSONL with one event per line
- [ ] Every agent message is logged (text, tool_use, tool_result, error)
- [ ] Gate results are logged with pass/fail, output, and attempt number
- [ ] Task summaries are generated in markdown with timeline, gates, files changed
- [ ] Index is appended with task metadata
- [ ] Orchestrator events (task_received, assigned, completed) are logged
- [ ] History sync GitHub Action runs on schedule
- [ ] `task history:search`, `task history:costs`, `task history:failures` work
- [ ] Retention cleanup removes old transcripts

## Open Questions

- **Transcript size:** Full transcripts with tool results can be enormous (file contents, build output). Should tool results be truncated? Or stored separately? Current design logs everything — monitor size and truncate if needed.
- **Real-time streaming:** The transcript writer logs to disk. Should it also emit events to the WebSocket gateway for real-time dashboard display? Yes — but the gateway handles that separately (Plan 16).
- **Cost tracking accuracy:** Cost is estimated from token usage. Different models have different pricing. The provider should report cost per session, and the transcript writer records it.
