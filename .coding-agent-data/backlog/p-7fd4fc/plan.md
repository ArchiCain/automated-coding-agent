---
id: p-7fd4fc
created: 2026-01-22T03:29:04.310Z
updated: 2026-01-22T03:32:34.395Z
---

# Claude Code Chatbot Integration

## Problem Statement

We want to integrate the existing Claude Code agent system (currently used in the local-only coding-agent apps) into the main automated-repo web application as a chatbot feature. This chatbot would allow users to interact with Claude Code directly from within any web application, with the agent able to "see" what the user sees through screenshots.

The key challenge is balancing the powerful context awareness (via screenshots) with cost implications, as sending screenshots with every message could become very expensive.

## Requirements

### Functional
- **Chatbot Interface**: A chat UI component that can be embedded in the main frontend/backend projects
- **Claude Code Integration**: Leverage the existing `SessionService` and Claude Agent SDK that's already working in the local-only project
- **Screenshot Context**: Ability to capture and send screenshots to Claude so it has visual context of what the user sees
- **Session Management**: Persistent chat sessions with full conversation history
- **Real-time Updates**: Live streaming of Claude's responses and tool usage (like the current agent system)

### Non-Functional
- Reuse existing Claude Code infrastructure:
  - `SessionService` (session management, Claude SDK integration)
  - `ClaudeCliService` (SDK wrapper)
  - Agent state management patterns
- Screenshot capture mechanism for the web browser
- Cost-aware screenshot strategy (configurable, not every message)
- WebSocket support for real-time streaming (already exists in main backend)

## Architecture

### Components to Build

#### Backend (projects/backend)
1. **Claude Code Module**: Port/adapt the claude-code-agent module from local-only
   - `SessionService` - manages Claude sessions
   - `ClaudeCodeController` - REST endpoints for chat
   - `ClaudeCodeGateway` - WebSocket gateway for real-time updates
2. **Screenshot Module**: Handle screenshot uploads and storage
   - Attachment storage (temp files or base64)
   - Image optimization/compression
   - Cleanup strategies

#### Frontend (projects/frontend)
1. **Chatbot Component**: Reusable chat interface
   - Message list with Markdown rendering
   - Input area with screenshot toggle
   - Screenshot capture using browser APIs
   - Tool use visualization (like current agent cards)
2. **Screenshot Service**: Browser screenshot capture
   - `html2canvas` or similar library
   - Viewport capture
   - Image compression before upload
3. **WebSocket Client**: Real-time message streaming
   - Similar to existing mastra-agents chat implementation

### Data Flow
```
User types message → [Optional: Capture screenshot] →
Send to backend via WebSocket →
Backend creates/resumes Claude session →
Claude SDK processes with screenshot attachment →
Stream responses back via WebSocket →
Frontend displays messages and tool usage in real-time
```

### Screenshot Strategy Options

**Option A: User-Controlled (Recommended)**
- Add a "📷 Include Screenshot" toggle button next to the message input
- User decides when context is valuable enough to include screenshot
- Default: OFF (cost-conscious)
- Benefits: User controls costs, only includes when needed

**Option B: Smart/Selective**
- First message in conversation: include screenshot
- Error messages or "I need more context": include screenshot
- Regular follow-ups: no screenshot
- Benefits: Automated, balances context and cost

**Option C: Every Message**
- Always include screenshot
- Benefits: Maximum context
- Drawbacks: Very expensive, potentially ~$0.50-1.00 per message

**Recommendation**: Start with Option A, potentially add Option B as an enhancement

## Scope

### In Scope
- Chat interface component for the main frontend
- Backend integration with Claude Agent SDK (reuse existing code)
- Screenshot capture and upload mechanism
- User-controlled screenshot inclusion (toggle button)
- Real-time streaming of responses via WebSocket
- Session persistence and resumption
- Basic cost tracking/display

### Out of Scope
- Multi-modal interactions beyond screenshots (video, audio)
- Advanced cost optimization strategies
- Team/shared chat sessions
- Screenshot editing/annotation before sending
- Automatic screenshot triggers based on page changes
- Integration with specific app features (keep chatbot generic)

## Open Questions

- [ ] How frequently do you expect users to include screenshots? (affects cost estimates)
- [ ] Should we set limits (e.g., max 5 screenshots per conversation)?
- [ ] Should screenshots be full page or just viewport?
- [ ] Image compression/quality settings?
- [ ] Where should this chatbot live in the main app? (Global floating button? Dedicated page?)
- [ ] Should this replace or complement the existing mastra-agents chat?
- [ ] Do we need file attachments beyond screenshots?
- [ ] Should we create a shared "claude-code" package/library?
- [ ] How do we handle the working directory (cwd) for Claude sessions?

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Screenshot Strategy | User-Controlled (Option A) | Balances context and cost, gives users control |
| Code Reuse Approach | Copy first, refactor later | Faster to implement, can create shared library if needed |
| Storage | Persist screenshots | Useful for conversation history, add cleanup cron later |

## Cost Estimates

### Screenshot Costs (Approximate)
- Claude 3.7 Sonnet pricing: ~$3 per million input tokens
- 1 screenshot (~1024x768, compressed): ~1,500-2,000 tokens
- Cost per screenshot: ~$0.003-0.006
- 100 messages with screenshots: ~$0.30-0.60
- 1,000 messages with screenshots: ~$3-6

### Text-Only Costs
- Average message: ~100-500 tokens
- Cost per message: ~$0.0003-0.0015
- 1,000 text messages: ~$0.30-1.50

**Conclusion**: Screenshots add meaningful cost (~10x) but are still quite affordable for selective use. User-controlled inclusion is the right approach.

## Implementation Notes

1. **Leverage Existing Code**: The local-only project already has a working Claude Agent SDK integration
   - Port the `SessionService` pattern
   - Reuse the event-driven streaming architecture
   - Adapt the WebSocket gateway pattern from mastra-agents

2. **Browser Screenshot APIs**:
   - `html2canvas`: Popular, reliable, works in all browsers
   - Native browser screenshot APIs are limited/restricted
   - Consider canvas compression before upload

3. **Storage**:
   - Screenshots can be temporary (deleted after session ends)
   - Or persist in session directory for conversation history
   - Recommendation: Persist for now, add cleanup cron later

4. **Security**:
   - Validate uploaded images (size limits, type checking)
   - Sanitize screenshots (ensure no sensitive data leakage)
   - Rate limiting on screenshot uploads
