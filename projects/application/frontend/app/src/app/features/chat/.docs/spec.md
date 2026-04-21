# Chat — Spec

## What it is

A real-time chat page at `/chat` where a signed-in user can have a conversation with the AI agent. Past conversations are listed in a sidebar on the left; the center column shows the current transcript; a composer at the bottom sends or cancels a reply.

## How it behaves

### Starting and leaving the chat page

When the user opens `/chat`, the page opens a live connection to the agent and loads the list of the user's past sessions. If the list is non-empty and no session was already active, the first session is selected automatically. Leaving the page closes the live connection; coming back reopens it.

### Managing sessions

The sidebar shows each session as a short identifier plus the time it was created. "New Chat" creates a session, puts it at the top of the list, and makes it active. Each row has a close icon that deletes that session; deleting the active session jumps to the next remaining one, or clears the main pane if none remain.

### Selecting a session

Clicking a session in the sidebar switches the center pane to that conversation. The page clears whatever was on screen, asks the server for the saved transcript and system prompt for that session, and replaces the pane with what comes back.

### Sending a message

The user types in the composer and presses Enter to send (Shift+Enter inserts a newline). The message shows up in the transcript immediately. The Send button is disabled until the user has typed something and has an active session.

### Receiving a reply

While the agent is replying, the Send button turns into a red Stop button and a spinner labeled "Agent is working..." shows under the transcript. Each message the agent sends back (assistant text, tool use, tool result) is appended to the transcript as it arrives. When the turn ends the Stop button reverts to Send and the spinner disappears. If something goes wrong on the server, a red error line is appended instead and the spinner disappears.

### Canceling a reply

Clicking Stop during a reply immediately clears the spinner on the client and tells the server to stop generating. The client does not wait for confirmation.

### Message rendering

The transcript styles messages by type: user and assistant messages render as bubbles; tool-use entries show with a wrench icon and the tool's name; tool-result entries show with a checkmark icon and the returned output; errors show with an error icon in red. The list auto-scrolls to the bottom whenever a new message arrives.

## Acceptance criteria

- [ ] Opening `/chat` loads the session list and opens the live connection.
- [ ] The first session is auto-selected only when nothing is currently selected.
- [ ] Leaving `/chat` closes the live connection; returning reopens it without duplicating it.
- [ ] "New Chat" creates a session, puts it at the top of the sidebar, and selects it.
- [ ] Deleting a session removes it; deleting the active one switches to the next, or empties the pane if none remain.
- [ ] Switching sessions clears the transcript, then populates it from the server's saved transcript.
- [ ] Pressing Enter in the composer sends the message; Shift+Enter inserts a newline.
- [ ] Send is disabled when the input is empty or no session is active.
- [ ] Sent messages appear in the transcript immediately.
- [ ] During a reply: Send turns to Stop, a spinner shows, each agent message is appended in order.
- [ ] When the reply ends normally: Stop reverts to Send, spinner clears.
- [ ] Server-reported errors render as a red error line and clear the spinner.
- [ ] Stop clears the spinner immediately and signals cancel to the server.
- [ ] The transcript scrolls to the bottom whenever a message is added.

## Known gaps

- The `system` message type exists in the payload shape but is not rendered (no template branch). System-typed entries show as empty rows. See `message-list.component.html:4-29`.
- Error handling is minimal on the REST side — 4xx/5xx from `/agent/sessions` surfaces as an unhandled RxJS error; users see no snackbar. See `chat.service.ts:53,69,76`.

## Code map

Precise pointers for an agent or a reader who needs the ground truth. Paths are relative to `projects/application/frontend/app/`.

| Concern | File · lines |
|---|---|
| Page layout (260px sidebar + main column, fills under 64px toolbar) | `src/app/features/chat/pages/chat.page.ts:35-47` |
| Open / close live connection on page init/destroy | `chat.page.ts:50-62`, `chat.service.ts:104-107` |
| Live connection opens with cookies; deduped if already open | `chat.service.ts:25-31` |
| Load session list on init | `chat.page.ts:54-57`, `chat.service.ts:52-59` |
| Create session (`POST /agent/sessions`) | `chat.service.ts:68-73`, `chat.api.ts:23-29` |
| Delete session (`DELETE /agent/sessions/:id`) + active-session shift | `chat.service.ts:75-86` |
| Select session emits `join:session` and clears transcript | `chat.service.ts:61-66` |
| Server → client: `agent:history`, `agent:message`, `agent:done`, `agent:error` | `chat.service.ts:33-49` |
| Send message (optimistic append + `message` emit) | `chat.service.ts:88-95` |
| Cancel (`cancel` emit, immediate local spinner off) | `chat.service.ts:97-102` |
| Composer: autosizing textarea (1–6 rows), Enter-sends | `components/message-input/message-input.component.ts:17-24,60-65` |
| Composer: Send toggles to Stop while streaming | `message-input.component.ts:31,78-85` |
| Composer: Send disabled when empty or no active session | `chat.page.ts:27`, `message-input.component.ts:31` |
| Message rendering by type (bubble / tool_use / tool_result / error) | `components/message-list/message-list.component.html:4-29` |
| Auto-scroll to bottom on every messages change | `message-list.component.ts:21-33` |
| Streaming spinner + label | `message-list.component.html:33-38` |
| Sidebar row layout (short id + shortTime + delete) | `components/session-sidebar/session-sidebar.component.ts:13-40,43-50` |
| Active-row highlight token | `--app-hover-overlay` |
| Types: `ChatSession`, `ChatMessage`, `SessionHistory` | `src/app/features/chat/types.ts` |
| Module (thin re-export wrapper) | `src/app/features/chat/chat.module.ts` |

### Backend contract

Shapes and events served by the `chat-agent` backend feature; see `projects/application/backend/app/src/features/chat-agent/.docs/spec.md` and `contracts.md`.
