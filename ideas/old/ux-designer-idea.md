# ASCII Documentation Tool: Visual Communication with Claude

A developer tool for creating and maintaining visual documentation using ASCII art. Claude generates and updates all diagrams through conversation, making it perfect for rapid prototyping, documentation, and visual communication without traditional design tools.

---

## Core Concept

ASCII art is a perfect **low-fidelity prototyping language** that Claude speaks fluently. Instead of wrestling with Figma or generating mockup images, developers can describe what they want and Claude generates clean ASCII diagrams that:

- Document existing UIs (pages, components, flows)
- Design new features visually before coding
- Show responsive layouts (desktop, tablet, mobile)
- Illustrate system architecture
- Map user flows and state transitions
- Explain infrastructure and deployments

**Key Principle**: Developers never edit ASCII manually - they only converse with Claude, which updates the diagrams.

---

## File Structure

```
.rtslabs/
  ascii-docs/
    frontend/
      pages/
        dashboard.md
        login.md
        settings.md
      components/
        navbar.md
        modal.md
        button-group.md
      flows/
        authentication.md
        checkout.md
    backend/
      architecture/
        package-structure.md
        module-dependencies.md
      flows/
        request-lifecycle.md
    infrastructure/
      aws-architecture.md
      deployment-pipeline.md
    flows/
      user-onboarding.md
      data-processing.md
```

**Organization**: Flexible structure - by project when it makes sense, by use case (architecture, flows) when that's clearer.

**Format**: `.md` files with YAML frontmatter for metadata and ASCII blocks for diagrams.

---

## File Format

```markdown
---
title: Settings Page
type: page
project: frontend
created: 2025-01-10T10:00:00Z
modified: 2025-01-10T14:30:00Z
---

# Settings Page

User settings interface with account and appearance configuration.

## Notes

- Dark mode toggle added in v2.1.0
- Tabs should maintain state on page reload
- Mobile view collapses tabs into accordion

## Desktop View

```ascii
┌──────────────────────────────────────────────────────────┐
│ [Logo]                            [Search] [🔔] [Profile]│
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Settings                                                │
│                                                          │
│  ┌──────────┐  ┌─────────────┐                          │
│  │ Account  │  │ Appearance  │                          │
│  └──────────┘  └─────────────┘                          │
│                                                          │
│  Appearance Settings                                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Dark Mode                           ●──○  OFF      │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Font Size                           [  Medium  ▾] │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Tablet View

```ascii
┌────────────────────────────────┐
│ [☰]          [Search] [Profile]│
├────────────────────────────────┤
│                                │
│  Settings                      │
│                                │
│  ┌────────┐  ┌──────────┐      │
│  │Account │  │Appearance│      │
│  └────────┘  └──────────┘      │
│                                │
│  Dark Mode      ●──○  OFF      │
│  Font Size      [Medium ▾]     │
│                                │
└────────────────────────────────┘
```

## Mobile View

```ascii
┌──────────────┐
│ [☰]     [👤] │
├──────────────┤
│              │
│  Settings    │
│              │
│  ▼ Account   │
│  ▼ Appearance│
│              │
│  Dark Mode   │
│  ●──○  OFF   │
│              │
│  Font Size   │
│  [Medium ▾]  │
│              │
└──────────────┘
```

## Related

- Component: `src/pages/Settings.tsx`
- Backlog: #123 - Add dark mode support
```

---

## Tool UI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ASCII Documentation Tool                                         [☰] [💬]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ EXPLORER ────┐  ┌─ PREVIEW (Read-only) ────────────────────────────┐  │
│  │               │  │                                                    │  │
│  │ 📁 frontend   │  │  # Settings Page                                  │  │
│  │   📁 pages    │  │                                                    │  │
│  │     ■ settings│  │  User settings interface with account and         │  │
│  │     □ login   │  │  appearance configuration.                        │  │
│  │     □ dashboard│  │                                                    │  │
│  │   📁 components│  │  ## Notes                                          │  │
│  │     □ navbar  │  │  - Dark mode toggle added in v2.1.0               │  │
│  │     □ modal   │  │                                                    │  │
│  │   📁 flows    │  │  ## Desktop View                                  │  │
│  │     □ auth    │  │  ```                                              │  │
│  │               │  │  ┌────────────────────────────────┐               │  │
│  │ 📁 backend    │  │  │ [Logo]        [Search] [👤]   │               │  │
│  │   📁 architecture│  │  ├────────────────────────────────┤               │  │
│  │     □ packages│  │  │ Settings                       │               │  │
│  │               │  │  │ ┌──────┐ ┌───────────┐         │               │  │
│  │ 📁 infrastructure│  │  │ │Account│ │Appearance │         │               │  │
│  │   □ aws-arch  │  │  │ └──────┘ └───────────┘         │               │  │
│  │               │  │  └────────────────────────────────┘               │  │
│  │ 📁 flows      │  │  ```                                              │  │
│  │   □ onboarding│  │                                                    │  │
│  │               │  │  ## Tablet View                                   │  │
│  │ + New Doc...  │  │  (scrollable preview)                             │  │
│  │               │  │                                                    │  │
│  └───────────────┘  └────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### UI Components

**Explorer (Left Sidebar)**
- Tree view of all ASCII docs
- Organized by project/category
- Selected doc highlighted (■)
- "+ New Doc..." to create new documentation

**Preview (Center Panel)**
- Read-only markdown rendering
- ASCII blocks render with monospace font
- Scrollable for long documents
- Shows frontmatter metadata

**Toolbar (Top)**
- [☰] Menu for settings/options
- [💬] Opens Claude modal for current doc

---

## Claude Integration

### Opening Claude

Clicking [💬] opens a modal with Claude that has:
- Full context of the current document
- Access to read relevant code files
- Knowledge of project structure
- Ability to create/update ASCII diagrams

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Claude - Settings Page                                              [X]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ Claude: I'm viewing the Settings page. It currently has Account and  │ │
│  │ Appearance tabs. How would you like to modify it?                    │ │
│  │                                                                       │ │
│  │ You: Add a dark mode toggle to the appearance section                │ │
│  │                                                                       │ │
│  │ Claude: I'll add a dark mode toggle. Should it be a switch or a      │ │
│  │ button? And should I show it in all three responsive views?          │ │
│  │                                                                       │ │
│  │ You: Switch, and yes all three views                                 │ │
│  │                                                                       │ │
│  │ Claude: ✓ Updated all views with dark mode toggle                    │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ Message...                                                     [Send] │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Claude's Context

When Claude is opened for a document, it has:
- The current markdown file content
- Path to related code files (if specified in frontmatter)
- Project structure knowledge
- History of the conversation in this session

Claude can:
- Read component code to document existing UIs
- Generate ASCII diagrams from descriptions
- Update existing diagrams iteratively
- Ask clarifying questions
- Suggest improvements

**Important**: Claude generates/updates the ASCII - developers never edit it manually.

---

## Key Workflows

### 1. Document Existing Page

Developer wants to document the current settings page.

```
User: Document the current settings page from the codebase

Claude: Let me read the Settings component...

[Claude reads src/pages/Settings.tsx, related components, styles]

Claude: I've analyzed the settings page. It has:
- Two tabs: Account and Appearance
- Dark mode toggle (switch component)
- Font size dropdown
- Responsive layout with different breakpoints

Would you like me to create ASCII diagrams for all three views?

User: Yes

Claude: ✓ Created .rtslabs/ascii-docs/frontend/pages/settings.md
      with desktop, tablet, and mobile views
```

**Result**: New markdown file with ASCII representations of all responsive views.

---

### 2. Design New Page

Developer needs to design a new notifications page.

```
User: Create a new page for user notifications

Claude: I'll create a notifications page. What should it include?
- List of notifications?
- Filter/sort options?
- Mark as read functionality?
- Real-time updates indicator?

User: List of notifications with mark as read, and a filter for read/unread

Claude: Should this be a full page or a dropdown panel?

User: Full page

Claude: ✓ Created notifications page with:
      - Header with "Notifications" title
      - Filter tabs (All / Unread)
      - Notification list with mark-as-read checkboxes
      - Mobile-responsive layout

Would you like me to add pagination or infinite scroll?
```

**Result**: New design documented before writing any code.

---

### 3. Iterate on Design

Developer reviewing existing dashboard doc.

```
User: The notification bell should be on the left side of the profile icon,
     not the right

Claude: ✓ Updated all three views - moved notification bell to the left of
      profile icon

User: Actually, can you show me what it looks like if we make the navbar
     sticky?

Claude: A sticky navbar would look the same visually, but I'll add a note
      to the metadata indicating sticky positioning. Should I also note the
      z-index behavior for overlays?

User: Yes good idea

Claude: ✓ Updated notes with sticky positioning details and z-index behavior
```

**Result**: Iterative refinement through conversation.

---

### 4. Document User Flow

Developer needs to map out the authentication flow.

```
User: Create a flow diagram for user authentication

Claude: I'll create an authentication flow. Should this include:
1. Just the happy path?
2. Error states?
3. Password reset flow?
4. OAuth options?

User: Include error states and password reset

Claude: ✓ Created authentication flow showing:
      - Login success → Dashboard
      - Login failure → Error message
      - Forgot password → Reset flow → Email confirmation

Would you like me to add any other paths?

User: Add OAuth flow with Google

Claude: ✓ Added OAuth branch showing Google sign-in alternative path
```

**Example Output**:

```ascii
┌─────────────────────────────────────────────────────────────────────────┐
│  Authentication Flow                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────┐                                                            │
│  │ Landing │                                                            │
│  └────┬────┘                                                            │
│       │                                                                 │
│       ├─ click "Login" ──────────────────┐                              │
│       │                                  │                              │
│       │                                  ▼                              │
│       │                             ┌─────────┐                         │
│       │                             │  Login  │                         │
│       │                             │  Page   │                         │
│       │                             └────┬────┘                         │
│       │                                  │                              │
│       │      valid credentials           │  invalid credentials         │
│       │      ┌───────────────────────────┼──────────┐                   │
│       │      ▼                           │          ▼                   │
│       │  ┌───────────┐                   │     ┌─────────┐              │
│       │  │ Dashboard │                   │     │  Error  │              │
│       │  └───────────┘                   │     │ Message │              │
│       │                                  │     └────┬────┘              │
│       │                                  │          │                   │
│       │                                  │  "Forgot password?"          │
│       │                                  │          ▼                   │
│       │                                  │     ┌─────────┐              │
│       │                                  │     │  Reset  │              │
│       │                                  │     │Password │              │
│       │                                  │     └────┬────┘              │
│       │                                  │          │                   │
│       │                                  │      email sent              │
│       │                                  │          ▼                   │
│       │                                  │     ┌──────────┐             │
│       │                                  │     │  Check   │             │
│       │                                  │     │  Email   │             │
│       │                                  │     └──────────┘             │
│       │                                  │                              │
│       └─ click "Sign in with Google" ────┼──────────┐                   │
│                                          │          ▼                   │
│                                          │     ┌─────────┐              │
│                                          │     │ Google  │              │
│                                          │     │  OAuth  │              │
│                                          │     └────┬────┘              │
│                                          │          │                   │
│                                          │      authorized              │
│                                          │          ▼                   │
│                                          │     ┌───────────┐            │
│                                          └─────│ Dashboard │            │
│                                                └───────────┘            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 5. Document System Architecture

Developer wants to visualize backend package structure.

```
User: Document the backend package architecture

Claude: Let me read the backend structure...

[Reads package.json, folder structure, imports]

Claude: I see 5 main packages. Should I show:
1. Just the package names and relationships?
2. Include key files/exports?
3. Show dependency direction?

User: Names and relationships with dependency direction

Claude: ✓ Created backend architecture diagram showing:
      - agent-runtime depends on project-config
      - decomposition-engine depends on agent-runtime
      - All packages export through their index.ts
```

**Example Output**:

```ascii
┌─────────────────────────────────────────────────────────────────────────┐
│  Backend Package Architecture                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                       ┌─────────────────┐                               │
│                       │ project-config  │                               │
│                       │                 │                               │
│                       │ - Detects types │                               │
│                       │ - Loads configs │                               │
│                       └────────┬────────┘                               │
│                                │                                        │
│                                │ (used by)                              │
│                                ▼                                        │
│                       ┌─────────────────┐                               │
│                       │ agent-runtime   │                               │
│                       │                 │                               │
│                       │ - Spawns agents │                               │
│                       │ - Process mgmt  │                               │
│                       └────────┬────────┘                               │
│                                │                                        │
│                                │ (used by)                              │
│                                ▼                                        │
│                    ┌──────────────────────┐                             │
│                    │ decomposition-engine │                             │
│                    │                      │                             │
│                    │ - Orchestrates flow  │                             │
│                    │ - Approval workflow  │                             │
│                    └───────────┬──────────┘                             │
│                                │                                        │
│                ┌───────────────┼───────────────┐                        │
│                │               │               │                        │
│                ▼               ▼               ▼                        │
│        ┌────────────┐  ┌────────────┐  ┌────────────┐                  │
│        │ plan-      │  │ validation │  │ endpoints  │                  │
│        │ storage    │  │            │  │ /gateways  │                  │
│        └────────────┘  └────────────┘  └────────────┘                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Use Cases

### For Planning
- **Sketch ideas quickly** - No Figma needed, just describe to Claude
- **Iterate through conversation** - "Move this here", "Make that bigger"
- **Get buy-in visually** - Show stakeholders before coding

### For Development
- **Quick reference** - See page layout while coding
- **Responsive behavior** - All breakpoints visible at once
- **Flow understanding** - Trace user journeys without clicking through app

### For Onboarding
- **Visual repo tour** - New developers see structure immediately
- **Component inventory** - What exists and what it looks like
- **Architecture overview** - How systems connect

### For Documentation
- **Living docs** - Stored in git, version controlled
- **Always up-to-date** - Easy to regenerate from code
- **Visual supplement** - Complements code comments

### For Communication
- **Low-fi mockups** - Share with team/stakeholders fast
- **No tool learning curve** - Just describe what you want
- **Fast feedback** - Iterate in minutes, not hours

---

## Why ASCII?

### Advantages

1. **Text-based** - Git-friendly, diffable, searchable
2. **Universal** - No special software needed to view
3. **Fast** - Renders instantly, no image loading
4. **Iterative** - Easy to update through conversation
5. **Claude-native** - Claude excels at ASCII art
6. **Low-commitment** - Quick to create, quick to throw away
7. **Accessible** - Screen readers can parse it

### When to Use ASCII vs Other Tools

**Use ASCII for**:
- Early-stage ideation
- Developer-to-developer communication
- Documentation
- Architecture diagrams
- Flow charts
- Quick mockups

**Graduate to Figma/Images for**:
- Final designs with pixel-perfect specs
- Brand/marketing materials
- Client presentations
- High-fidelity prototypes with interactions

**ASCII is for structure and layout - Figma is for polish and style.**

---

## Integration Points

### With Backlog System

ASCII docs can reference backlog items:

```markdown
## Related

- Backlog: #123 - Add dark mode support
- Backlog: #145 - Responsive settings page
```

When planning frontend features in the backlog, developers can:
1. Create ASCII docs for proposed UI
2. Link them in the backlog item
3. Iterate on design before decomposing into tasks
4. Use as reference during implementation

### With Decomposition UI

The main dashboard (from decomp-ui-idea-extended.md) can have buttons to open the ASCII tool:
- In project boxes: "📄 View Docs"
- In backlog items: "🎨 Design UI"
- In component views: "📐 Show Diagram"

### With Projects

Each project (frontend, backend, etc.) can have its own ASCII docs:
- Frontend: pages, components, flows
- Backend: architecture, package structure, API flows
- Infrastructure: deployment diagrams, AWS architecture

---

## Technical Implementation Notes

### Claude Context Loading

When Claude is opened for a document:

1. **Read the current document** - Full markdown content
2. **Parse frontmatter** - Extract metadata, related files
3. **Load related code** - If component paths specified, read them
4. **Understand project context** - Know where in the codebase this lives

### File Operations

Claude can:
- **Create** new `.md` files in appropriate directories
- **Update** existing files by rewriting sections
- **Read** component code to generate accurate diagrams
- **Reference** package.json, routing files, etc. for context

### Git Integration

- All changes tracked in git like regular files
- Merge conflicts handled like code conflicts
- Commit messages: "docs(ui): add settings page diagram"
- Part of normal development workflow

### Responsive Views

Files can have multiple ASCII blocks for different breakpoints:
- Desktop (full width, all features)
- Tablet (medium width, some condensing)
- Mobile (narrow, vertical stacking)

Claude generates all three when creating UI docs.

---

## Example Document Types

### Page Documentation
```
.rtslabs/ascii-docs/frontend/pages/dashboard.md
```
Shows the page layout, components, responsive behavior.

### Component Documentation
```
.rtslabs/ascii-docs/frontend/components/modal.md
```
Shows component states (open, closed, loading, error).

### User Flow
```
.rtslabs/ascii-docs/flows/checkout.md
```
Maps user journey through screens and states.

### System Architecture
```
.rtslabs/ascii-docs/backend/architecture/packages.md
```
Shows how packages/modules relate and depend on each other.

### Infrastructure
```
.rtslabs/ascii-docs/infrastructure/aws-architecture.md
```
Visualizes cloud resources and connections.

### API Flow
```
.rtslabs/ascii-docs/backend/flows/request-lifecycle.md
```
Shows how requests flow through middleware, controllers, services.

---

## Version Control

All ASCII docs are:
- **Text files** - Perfect for git
- **Diffable** - Changes show clearly in PRs
- **Mergeable** - Standard conflict resolution
- **Searchable** - Grep through all diagrams

Example git diff:

```diff
## Desktop View

```ascii
┌──────────────────────────────────────┐
│ [Logo]            [Search] [Profile] │
├──────────────────────────────────────┤
│                                      │
│  Settings                            │
│                                      │
│  ┌──────────┐  ┌─────────────┐      │
│  │ Account  │  │ Appearance  │      │
│  └──────────┘  └─────────────┘      │
│                                      │
+│  Dark Mode     ●──○  OFF            │
│                                      │
└──────────────────────────────────────┘
```

---

## Future Enhancements

### Phase 1 (MVP)
- Basic document creation/editing via Claude
- File explorer and preview
- Markdown rendering with ASCII blocks
- Git storage in .rtslabs/ascii-docs/

### Phase 2
- Link to backlog items
- Show related code files
- Quick navigation between related docs
- Search across all ASCII docs

### Phase 3
- Generate component from ASCII
- Compare ASCII to actual implementation
- Detect drift between doc and reality
- Auto-update from code changes

### Phase 4
- Collaborative editing
- Comments/annotations on diagrams
- Export to other formats (SVG, PNG for presentations)
- Integration with CI/CD for doc validation

---

## Success Metrics

This tool succeeds when:

1. **Developers use it naturally** - Part of normal workflow
2. **Docs stay current** - Updated as code changes
3. **Onboarding faster** - New devs understand structure quickly
4. **Less confusion** - Fewer "how does this work?" questions
5. **Design before code** - UIs sketched before implementation
6. **Better communication** - Team aligned on visual direction

---

## Summary

The ASCII Documentation Tool is a **conversation-driven visual prototyping and documentation system**. Developers describe what they want to see, and Claude generates clean ASCII diagrams that live in git alongside the code.

It's perfect for:
- 🎨 Designing UIs without Figma
- 📚 Documenting existing systems
- 🗺️ Mapping user flows
- 🏗️ Visualizing architecture
- 💬 Communicating visually with team
- 🚀 Moving fast from idea to implementation

**Everything is text, everything is in git, everything is generated through conversation with Claude.**
