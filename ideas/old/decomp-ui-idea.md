# Decomposition UI Design

A visual flowchart-style interface for hierarchical task decomposition with real-time updates and interactive node editing.

## Design Principles

- **Left-to-right flow**: Ideas start on the left, decompose into increasingly granular tasks to the right
- **Strict horizontal layout**: Children always appear to the right of their parent
- **Straight-line connections**: Right-angle connector lines (org-chart style)
- **Progressive zoom levels**: More detail visible as you zoom in
- **Real-time updates**: WebSocket-driven live updates as agent decomposes tasks
- **Collapsible subtrees**: Reduce visual clutter by collapsing completed or irrelevant branches

---

## High-Level View (Zoomed Out)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ◀ ══════════════════════════════ SCROLL ══════════════════════════════ ▶              │
│                                                                                         │
│  ▲                                                                                      │
│  ║     ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐  │
│  ║     │             │      │   Backend   │──────│  Auth       │──────│ POST /login │  │
│  ║     │             │──────│   Project   │      │  Module     │      └─────────────┘  │
│  S     │             │      └─────────────┘      └─────────────┘      ┌─────────────┐  │
│  C     │   Feature   │                     ──────│  User       │──────│ GET /users  │  │
│  R     │   Request   │                           │  Module     │      └─────────────┘  │
│  O     │             │      ┌─────────────┐      └─────────────┘      ┌─────────────┐  │
│  L     │  "Add user  │──────│  Frontend   │──────│  Login      │──────│ LoginForm   │  │
│  L     │   auth..."  │      │   Project   │      │  Page       │      └─────────────┘  │
│  ║     │             │      └─────────────┘      └─────────────┘      ┌─────────────┐  │
│  ║     │             │                     ──────│  Dashboard  │──────│ UserList    │  │
│  ║     └─────────────┘                           │  Page       │      └─────────────┘  │
│  ▼                                               └─────────────┘                        │
│                                                                                         │
│  [Level 0: Idea]    [Level 1: Projects]   [Level 2: Modules]   [Level 3: Tasks]        │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Box States

```
┌─ PENDING ─────────┐   ┌─ IN PROGRESS ─────┐   ┌─ NEEDS APPROVAL ──┐   ┌─ APPROVED ───────┐
│ ○ Auth Module     │   │ ◐ Auth Module     │   │ ◉ Auth Module     │   │ ✓ Auth Module    │
│                   │   │ ▓▓▓▓░░░░░░ 40%   │   │                   │   │                  │
│ [not started]     │   │ [decomposing...]  │   │ [review required] │   │ [ready]          │
└───────────────────┘   └───────────────────┘   └───────────────────┘   └──────────────────┘

┌─ FAILED ──────────┐   ┌─ VALIDATING ──────┐   ┌─ COMPLETE ────────┐
│ ✗ Auth Module     │   │ ⟳ Auth Module     │   │ ✓✓ Auth Module    │
│                   │   │                   │   │                   │
│ [validation fail] │   │ [checking DoD...] │   │ [done + verified] │
└───────────────────┘   └───────────────────┘   └───────────────────┘
```

---

## Full UI Layout

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ┌─ TOOLBAR ───────────────────────────────────────────────────────────────────────────────────┐ │
│ │ [+ New Idea]  [⟳ Refresh]  │  Zoom: [−] ████░░░░░░ [+]  │  [📋 List View]  [🔲 Graph View] │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                 │
│ ┌─ CANVAS (pan & zoom) ─────────────────────────────────────────────────────────────────────┐  │
│ │                                                                                            │  │
│ │                                                                                            │  │
│ │    ┌───────────┐      ┌───────────┐      ┌───────────┐      ┌───────────┐                 │  │
│ │    │           │      │           │──────│  Auth     │──────│ POST      │                 │  │
│ │    │           │──────│  Backend  │      │  Module   │      │ /login    │                 │  │
│ │    │           │      │           │──────│───────────│      └───────────┘                 │  │
│ │    │  "Add     │      └───────────┘      │  User     │──────┬───────────┐                 │  │
│ │    │   user    │                         │  Module   │      │ GET       │                 │  │
│ │    │   auth    │      ┌───────────┐      └───────────┘      │ /users    │                 │  │
│ │    │   ..."    │──────│           │──────┬───────────┐      └───────────┘                 │  │
│ │    │           │      │  Frontend │      │  Login    │──────┬───────────┐                 │  │
│ │    │           │      │           │      │  Page     │      │ LoginForm │                 │  │
│ │    └───────────┘      │           │──────│───────────│      └───────────┘                 │  │
│ │                       └───────────┘      │  Dashboard│──────┬───────────┐                 │  │
│ │                                          │  Page     │      │ UserList  │                 │  │
│ │                                          └───────────┘      └───────────┘                 │  │
│ │                                                                                            │  │
│ │                                                                                 ┌───────┐  │  │
│ │                                                                                 │ ▪─▪─▪ │  │  │
│ │                                                                                 │ │ [□] │  │  │
│ │                                                                                 │ ▪─▪─▪ │  │  │
│ │                                                                                 └───────┘  │  │
│ └────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                 │
│ ┌─ STATUS BAR ────────────────────────────────────────────────────────────────────────────────┐ │
│ │ ◉ Agent: Decomposing "User Module"...  │  12 tasks  │  3 pending approval  │  2 complete   │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Zoom Levels

### Level 1: Zoomed Out (Bird's Eye)

Minimal detail - just status icons and connection lines.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│    [✓]────[◉]────[○]────[○]                                            │
│           │                                                             │
│           └──────[○]────[○]                                            │
│                                                                         │
│    [✓]────[✓]────[◐]────[○]────[○]                                     │
│                  │                                                      │
│                  └──────[○]                                            │
│                                                                         │
│    Legend: [✓]=complete [◉]=needs approval [◐]=in progress [○]=pending │
└─────────────────────────────────────────────────────────────────────────┘
```

### Level 2: Medium Zoom (Titles Visible)

Box titles and status indicators visible.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│    ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐         │
│    │✓ Backend│─────│◉ Auth   │─────│○ POST   │─────│○ DTO    │         │
│    └─────────┘     │  Module │     │  /login │     │  Types  │         │
│                    └─────────┘     └─────────┘     └─────────┘         │
│                         │                                               │
│                    ┌─────────┐     ┌─────────┐                         │
│                    │○ User   │─────│○ GET    │                         │
│                    │  Module │     │  /users │                         │
│                    └─────────┘     └─────────┘                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Level 3: Zoomed In (Full Preview)

Full preview with description snippets, attachment counts, and validator progress.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌───────────────────────┐          ┌───────────────────────┐              │
│  │ ◉ Auth Module         │          │ ○ POST /login         │              │
│  │───────────────────────│          │───────────────────────│              │
│  │ Authentication and    │──────────│ Login endpoint with   │              │
│  │ authorization module  │          │ JWT token response    │              │
│  │───────────────────────│          │───────────────────────│              │
│  │ 📎 2 attachments      │          │ Validator: 5 checks   │              │
│  │ ✓ 3/5 validator items │          │ Children: 3           │              │
│  └───────────────────────┘          └───────────────────────┘              │
│         │                                                                   │
│         │                           ┌───────────────────────┐              │
│         └───────────────────────────│ ○ User Service        │              │
│                                     │───────────────────────│              │
│                                     │ CRUD operations for   │              │
│                                     │ user management       │              │
│                                     └───────────────────────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Collapse/Expand Behavior

### Expanded State

```
    ┌───────────┐     ┌───────────┐     ┌───────────┐
    │  Backend  │─────│   Auth    │─────│ POST      │
    │           │     │   Module  │     │ /login    │
    └───────────┘     │           │─────│───────────│
                      │           │     │ GET       │
                      └───────────┘     │ /logout   │
                           │            └───────────┘
                      ┌───────────┐     ┌───────────┐
                      │   User    │─────│ GET       │
                      │   Module  │     │ /users    │
                      └───────────┘     └───────────┘
```

### Collapsed State

Click chevron or double-click to collapse. Shows child count.

```
    ┌───────────┐     ┌───────────┐
    │  Backend  │─────│ ▶ Auth    │ ← Collapsed (▶ indicates hidden children)
    │           │     │   Module  │
    └───────────┘     │   (4)     │ ← Count of hidden descendants
                      │───────────│
                      │ ▶ User    │
                      │   Module  │
                      │   (2)     │
                      └───────────┘
```

---

## Real-time Animation (WebSocket Updates)

### New Node Appearing

```
Frame 1:                    Frame 2:                    Frame 3:
┌─────────┐                 ┌─────────┐     ┌ ─ ─ ─ ┐   ┌─────────┐     ┌─────────┐
│  Auth   │─────            │  Auth   │─ ─ ─   ???   │   │  Auth   │─────│  POST   │
│  Module │                 │  Module │     └ ─ ─ ─ ┘   │  Module │     │ /login  │
└─────────┘                 └─────────┘                 └─────────┘     └─────────┘
                                          (fading in)                   (solid)
```

### Decomposition In Progress

```
┌─────────────────┐
│ ◐ Auth Module   │
│─────────────────│
│ ▓▓▓▓▓░░░░░ 50%  │  ← Progress bar
│                 │
│ Analyzing...    │  ← Status text
│ ┌─ ─ ─ ─ ─ ─ ┐ │
│ │ ◌ ◌ ◌       │ │  ← Placeholder dots for expected children
│ └─ ─ ─ ─ ─ ─ ┘ │
└─────────────────┘
```

---

## Expanded Node View (Full Screen Modal)

When a node is clicked, it expands to a full-screen modal for editing.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  ╭─────────────────────────────────────────────────────────────────────────────────────────╮│
│  │                                                                            [X] Close   ││
│  │  ◉ POST /api/auth/login                                                               ││
│  │  ═══════════════════════════════════════════════════════════════════════════════════  ││
│  │                                                                                        ││
│  │  ┌─ BREADCRUMB ──────────────────────────────────────────────────────────────────────┐││
│  │  │  Feature Request  ▸  Backend  ▸  Auth Module  ▸  POST /login                      │││
│  │  └───────────────────────────────────────────────────────────────────────────────────┘││
│  │                                                                                        ││
│  │  ┌─ DESCRIPTION ─────────────────────────────────────────────────────────────[Edit]──┐││
│  │  │                                                                                    │││
│  │  │  Create login endpoint that accepts email/password credentials, validates them    │││
│  │  │  against the database, and returns a JWT access token. The refresh token should   │││
│  │  │  be set as an httpOnly cookie for security.                                       │││
│  │  │                                                                                    │││
│  │  │  Request body:                                                                     │││
│  │  │  ```json                                                                           │││
│  │  │  { "email": "string", "password": "string" }                                      │││
│  │  │  ```                                                                               │││
│  │  │                                                                                    │││
│  │  └────────────────────────────────────────────────────────────────────────────────────┘││
│  │                                                                                        ││
│  │  ┌─ ATTACHMENTS ─────────────────────────────────────────────────────────────[Add +]─┐││
│  │  │                                                                                    │││
│  │  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                       │││
│  │  │  │ 📷             │  │ 📄             │  │ 🔗             │                       │││
│  │  │  │   [mockup]     │  │   api-spec.pdf │  │   Figma Link   │                       │││
│  │  │  │                │  │   124 KB       │  │                │                       │││
│  │  │  │  [View] [Del]  │  │  [View] [Del]  │  │  [Open] [Del]  │                       │││
│  │  │  └────────────────┘  └────────────────┘  └────────────────┘                       │││
│  │  │                                                                                    │││
│  │  └────────────────────────────────────────────────────────────────────────────────────┘││
│  │                                                                                        ││
│  │  ┌─ VALIDATOR (Definition of Done) ──────────────────────────────────────────[Edit]──┐││
│  │  │                                                                                    │││
│  │  │  ☐  Endpoint returns 200 with valid JWT on successful login                       │││
│  │  │  ☐  Endpoint returns 401 with error message on invalid credentials                │││
│  │  │  ☐  Refresh token set in httpOnly cookie with secure flag                         │││
│  │  │  ☐  Rate limiting: max 5 attempts per minute per IP                               │││
│  │  │  ☐  Input validation for email format and password length                         │││
│  │  │  ☐  Unit tests cover happy path and error cases (min 80% coverage)                │││
│  │  │                                                                                    │││
│  │  │  ┌──────────────────────────────────────────────────────────────────────────────┐ │││
│  │  │  │ + Add validator item...                                                      │ │││
│  │  │  └──────────────────────────────────────────────────────────────────────────────┘ │││
│  │  │                                                                                    │││
│  │  └────────────────────────────────────────────────────────────────────────────────────┘││
│  │                                                                                        ││
│  │  ┌─ CHILDREN ────────────────────────────────────────────────────────────────────────┐││
│  │  │                                                                                    │││
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │││
│  │  │  │ ○ DTO Types  │  │ ○ Controller │  │ ○ Service    │  │ ○ Unit Tests │          │││
│  │  │  │              │  │              │  │   Method     │  │              │          │││
│  │  │  │   [Open]     │  │   [Open]     │  │   [Open]     │  │   [Open]     │          │││
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘          │││
│  │  │                                                                                    │││
│  │  │  [+ Add Child Task]                                                               │││
│  │  │                                                                                    │││
│  │  └────────────────────────────────────────────────────────────────────────────────────┘││
│  │                                                                                        ││
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐  ││
│  │  │  [✓ Approve]    [↻ Regenerate]    [🗑 Delete]    [◀ Parent]    [▶ Next Sibling] │  ││
│  │  └─────────────────────────────────────────────────────────────────────────────────┘  ││
│  │                                                                                        ││
│  ╰─────────────────────────────────────────────────────────────────────────────────────────╯│
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Navigation & Interaction Model

### Keyboard Controls

| Key | Action |
|-----|--------|
| Arrow keys | Pan viewport |
| +/- | Zoom in/out |
| Enter | Expand selected box |
| Esc | Back to overview / Close modal |
| Tab | Next sibling |
| Shift+Tab | Previous sibling |
| [ | Go to parent |
| ] | Go to first child |

### Mouse Controls

| Action | Result |
|--------|--------|
| Click + Drag | Pan canvas |
| Scroll wheel | Zoom in/out |
| Click box | Select box |
| Double-click | Expand to modal |
| Right-click | Context menu |

### Touch Gestures

| Gesture | Result |
|---------|--------|
| Pinch | Zoom |
| Two-finger pan | Scroll canvas |
| Tap | Select |
| Long press | Context menu |

---

## Mini-map

Located in bottom-right corner, shows entire graph with current viewport highlighted.

```
                                    ┌─────────────────────┐
                                    │ ▪───▪───▪───▪       │
                                    │     │   │   │       │
                                    │     ▪───▪───▪       │
                                    │ ┌───────┐           │
                                    │ │ ░░░░░ │ ◄─ viewport│
                                    │ └───────┘           │
                                    └─────────────────────┘
```

---

## Data Model

### DecompositionNode

```typescript
interface DecompositionNode {
  id: string;
  parentId: string | null;

  // Content
  title: string;
  description: string;
  type: 'idea' | 'project' | 'module' | 'component' | 'task';

  // Status
  status: 'pending' | 'decomposing' | 'needs_approval' | 'approved' | 'validating' | 'complete' | 'failed';
  progress?: number; // 0-100 when decomposing

  // Validator / Definition of Done
  validator: ValidatorItem[];

  // Attachments
  attachments: Attachment[];

  // UI State
  isCollapsed: boolean;
  position: { x: number; y: number }; // Calculated by layout engine

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  projectType?: string; // e.g., 'nestjs-backend', 'react-frontend'
}

interface ValidatorItem {
  id: string;
  description: string;
  isChecked: boolean;
  isAutoGenerated: boolean;
}

interface Attachment {
  id: string;
  type: 'image' | 'file' | 'link';
  name: string;
  url: string;
  thumbnailUrl?: string;
  size?: number;
}
```

---

## WebSocket Events

### Client -> Server

```typescript
interface ClientEvents {
  'node:create': { parentId: string; title: string; description: string };
  'node:update': { nodeId: string; changes: Partial<DecompositionNode> };
  'node:delete': { nodeId: string };
  'node:approve': { nodeId: string };
  'node:regenerate': { nodeId: string; feedback?: string };
  'node:decompose': { nodeId: string }; // Trigger AI decomposition
  'validator:toggle': { nodeId: string; validatorId: string };
}
```

### Server -> Client

```typescript
interface ServerEvents {
  'node:created': DecompositionNode;
  'node:updated': { nodeId: string; changes: Partial<DecompositionNode> };
  'node:deleted': { nodeId: string };
  'decomposition:started': { nodeId: string };
  'decomposition:progress': { nodeId: string; progress: number; message: string };
  'decomposition:child_added': { parentId: string; child: DecompositionNode };
  'decomposition:completed': { nodeId: string; children: DecompositionNode[] };
  'decomposition:failed': { nodeId: string; error: string };
  'validation:started': { nodeId: string };
  'validation:completed': { nodeId: string; passed: boolean; results: ValidatorResult[] };
}
```

---

## Component Hierarchy

```
AgentWorkspace/
├── Toolbar/
│   ├── NewIdeaButton
│   ├── ZoomControls
│   └── ViewToggle (Graph/List)
│
├── Canvas/
│   ├── CanvasViewport (handles pan/zoom)
│   │   ├── ConnectionLines (SVG layer)
│   │   └── NodeLayer/
│   │       └── DecompositionNode[] (positioned absolutely)
│   │           ├── NodeHeader (icon, title, status)
│   │           ├── NodePreview (description snippet - zoom level 3)
│   │           └── CollapseToggle
│   │
│   └── Minimap
│
├── NodeDetailModal/
│   ├── Breadcrumb
│   ├── DescriptionEditor (markdown)
│   ├── AttachmentsPanel
│   ├── ValidatorPanel
│   ├── ChildrenPreview
│   └── ActionButtons
│
└── StatusBar/
    ├── AgentStatus
    └── TaskCounts
```

---

## Technology Considerations

### Canvas Rendering Options

1. **React Flow** - Purpose-built for node-based UIs, handles pan/zoom/connections
2. **D3.js** - Maximum flexibility, more complex implementation
3. **Custom Canvas/SVG** - Full control, significant development effort

### Layout Algorithm

Use a hierarchical layout algorithm (e.g., Dagre) to automatically position nodes:
- Nodes at same level aligned vertically
- Consistent spacing between levels (horizontal)
- Minimize edge crossings

### Performance

- Virtualize nodes outside viewport at low zoom levels
- Debounce pan/zoom updates
- Use CSS transforms for smooth animations
- Batch WebSocket updates for bulk operations
