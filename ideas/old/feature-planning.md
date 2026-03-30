# Feature Planning

This document tracks all planned and in-progress features across the entire platform. For detailed design documentation, see the `ideas/` directory.

---

## Table of Contents

- [Phase 1: Active Development](#phase-1-active-development)
  - [Coding Agent Platform](#coding-agent-platform)
  - [Core Platform Features](#core-platform-features)
  - [Observability & Operations](#observability--operations)
  - [Design & Communication Tools](#design--communication-tools)
- [Phase 2: Future Development](#phase-2-future-development)
  - [Platform Improvements](#platform-improvements)
  - [Multi-Platform Expansion](#multi-platform-expansion)

---

## Phase 1: Active Development

### Coding Agent Platform

#### 1. Decomposition Flowchart UI
Interactive left-to-right hierarchical visualization showing how features decompose into tasks. Features progressive zoom levels (bird's eye view showing only status icons, medium zoom showing titles, full zoom showing descriptions and validators). Real-time WebSocket updates animate nodes appearing as the agent decomposes. Collapsible subtrees manage visual complexity. Box states indicate pending, decomposing, needs approval, approved, complete, or failed. Full-screen task editor modal includes markdown description editor, attachments panel (images, files, links), validators/definition of done checklist, and children preview.

**Reference**: `ideas/decomp-ui-idea.md`

#### 2. Repository Management Dashboard
Top-level dashboard providing a single pane of glass for the entire development ecosystem. Shows three main sections: Projects (actual code projects like backend, frontend, e2e), Environments (local Docker environments for main and each worktree, plus remote infrastructure deployments), and Backlog (work items from idea through completion). Everything is a box that can be clicked to drill down for more detail. Each level has contextual Claude AI assistance available.

**Reference**: `ideas/decomp-ui-idea-extended.md`

#### 3. Full Backlog Lifecycle
Complete workflow management from Draft → Planning → Ready → Running → Review → Complete. Draft phase includes plan creation and initial decomposition. Planning phase has interactive multi-stage decomposition with approval gates. Ready phase means all tasks are atomic and approved. Running phase includes worktree creation, Docker environment spin-up, and autonomous agent execution. Review phase validates all work before merge. Complete phase archives the plan.

**Reference**: `ideas/decomp-ui-idea-extended.md`

#### 4. Claude Integration at All Levels
Context-aware AI assistance available throughout the platform. Repo-level Claude has high-level knowledge of entire repository and can run any task command. Project-level Claude has deep context about specific projects, packages, and patterns. Task-level Claude understands individual task requirements and can provide implementation guidance. All Claude interactions are read-only advisors with task execution capabilities - file changes flow through the Backlog system.

**Reference**: `ideas/decomp-ui-idea-extended.md`

#### 5. Multi-Stage Decomposition
Interactive breakdown workflow from high-level Feature → specific Projects → detailed Modules → atomic Tasks. Each stage requires user approval before proceeding. System asks clarifying questions and allows iterative refinement. Identifies which projects (frontend, backend, database, etc.) are affected by a feature request. Generates appropriate subtasks for each project based on that project's architecture and patterns.

**Reference**: `claude-automation-research/high-level-overview.md`

#### 6. Task Detail Editor
Full-screen modal providing comprehensive task editing capabilities. Breadcrumb navigation shows task hierarchy. Rich markdown editor for detailed descriptions with syntax highlighting. Attachments panel supports images (with thumbnails), PDFs, and external links. Validators/Definition of Done panel with checkable items that can be auto-generated or manually added. Children preview shows all subtasks with quick navigation. Action buttons for approve, regenerate, delete, navigate to parent/siblings.

**Reference**: `ideas/decomp-ui-idea.md`

#### 7. Dependency Graph Visualization
ReactFlow-based directed acyclic graph (DAG) showing task execution order and dependencies. Node colors indicate task state (pending, in progress, completed, failed, blocked). Border colors indicate complexity (trivial, simple, moderate, complex). Interactive features include pan and zoom, node selection, cycle detection warnings, and minimap for navigation. Displays execution levels showing which tasks can run in parallel.

**Reference**: Current implementation in `coding-agent-frontend/app/src/packages/plan-editor/components/DependencyGraph.tsx`

#### 8. Real-Time Decomposition Animation
WebSocket-driven visual updates as the agent decomposes tasks. New nodes fade in with placeholder indicators while processing. Progress bars show decomposition percentage. Status messages update to reflect current phase (analyzing, planning, decomposing, validating, building DAG). Smooth transitions between states create engaging user experience.

**Reference**: `ideas/decomp-ui-idea.md`

#### 9. Environment Management UI
Visual management interface for both local and remote environments. Local environments show Docker containers, ports, and services (backend, frontend, postgres, redis) with start/stop/restart controls. Remote environments display AWS resources (ECS tasks, RDS instances, ALB status) with links to actual services. Shows associated backlog items and provides quick access to logs, metrics, and deployment controls.

**Reference**: `ideas/decomp-ui-idea-extended.md`

### Core Platform Features

#### 10. Enhanced User Management
Database-first approach storing user data in PostgreSQL (firstname, lastname, email, etc.) while registering authentication in Keycloak. Uses hard deletes instead of soft deletes (disable feature provides soft delete functionality). Polished auth flow where admin creates user with temporary password, user is forced to change password on first login, and admin can reset user passwords as needed.

**Reference**: `TODO.md` (lines 57-63)

#### 11. Document Upload with MinIO
S3-compatible object storage for document management using MinIO. Document upload and management interface allows users to upload files with metadata, organize documents in folders, preview common file types, and manage permissions. MinIO provides self-hosted alternative to AWS S3 with identical API compatibility.

**Reference**: `TODO.md` (lines 65-70)

#### 12. RAG Workflow Integration
Document processing with retrieval-augmented generation implemented as Mastra workflow. Every uploaded document is automatically processed: text extraction, chunking, embedding generation, and vector storage. Enables semantic search across documents and provides context-aware responses in chat interactions. Integrates with the conversational AI system.

**Reference**: `TODO.md` (lines 65-70)

#### 13. Account Management
Self-service account management interface where users can view and update their profile information (name, email, phone), change their password with current password verification, manage notification preferences, and view account activity history. Separate from admin user management - this is for individual users managing their own accounts.

**Reference**: `TODO.md` (line 72-73)

#### 14. Notifications System
Multi-channel notification system supporting screen banners/toasts for immediate in-app notifications, SMS messages for critical alerts, and email notifications for longer-form updates. Users can configure preferences for which events trigger which notification types. Includes notification history, mark as read functionality, and delivery status tracking.

**Reference**: `TODO.md` (lines 75-78)

#### 15. Living Documentation System
Automated documentation maintenance using Claude Code Skills and Stop Hooks. README.md and CLAUDE.md files exist in every package, project, and feature directory. Skills detect when code changes and automatically update related documentation. Stop Hooks ensure documentation is reviewed before completing work. Creates self-documenting codebase that stays current.

**Reference**: `TODO.md` (lines 80-81)

### Observability & Operations

#### 16. Logging & Monitoring Stack
Self-hosted Grafana LGTM stack (Loki for logs, Tempo for traces, Prometheus for metrics) providing complete observability. OpenTelemetry Collector receives telemetry from all services and routes to appropriate backends. Unified Grafana dashboards show logs, metrics, and traces in one place. Works identically in local development and AWS deployment.

**Reference**: `ideas/logging-monitoring-stack.md`

#### 17. Status Page
Uptime Kuma providing beautiful public status page for service monitoring. Monitors endpoints via HTTP, TCP, and DNS checks. Shows current operational status (operational, degraded, down) with incident history and scheduled maintenance windows. Clients can bookmark public status page and subscribe to updates.

**Reference**: `ideas/logging-monitoring-stack.md`

#### 18. Metrics Collection
Prometheus-based metrics collection from all services. Backend exposes `/metrics` endpoint with HTTP request duration (p50, p95, p99), request count by endpoint and status, active connections (HTTP and WebSocket), CPU and memory usage, and custom business metrics. PostgreSQL exporter provides database metrics. Node exporter provides runtime metrics.

**Reference**: `ideas/logging-monitoring-stack.md`

#### 19. Distributed Tracing
Grafana Tempo storing distributed traces across service boundaries. OpenTelemetry SDK provides automatic instrumentation for HTTP requests and database queries. Trace context propagation headers link requests across services. Identifies slow operations and bottlenecks in request flow.

**Reference**: `ideas/logging-monitoring-stack.md`

#### 20. Alerting System
Grafana-based alerting with multiple notification channels. Alert rules detect error rate thresholds, latency thresholds, resource utilization limits, and service downtime. Notifications go to email, Slack/Discord webhooks, or PagerDuty. Includes alert history, acknowledgment tracking, and maintenance window scheduling.

**Reference**: `ideas/logging-monitoring-stack.md`

### Design & Communication Tools

#### 21. ASCII Documentation Tool
Claude-powered visual prototyping and documentation using ASCII art. Developers describe what they want and Claude generates clean ASCII diagrams. File explorer shows all documentation organized by project/category. Preview panel renders markdown with monospace ASCII blocks. Claude modal provides context-aware assistance for creating and updating diagrams. Everything is text-based, git-friendly, and diffable.

**Reference**: `ideas/ux-designer-idea.md`

#### 22. Responsive Design Documentation
Visual documentation showing desktop, tablet, and mobile views for all UI components. Claude generates all three responsive breakpoints automatically when creating page documentation. ASCII diagrams show how layouts adapt at different screen sizes, which components collapse or stack, and how navigation patterns change.

**Reference**: `ideas/ux-designer-idea.md`

#### 23. User Flow Mapping
Visual journey mapping showing how users move through the application. ASCII flowcharts illustrate user paths from entry point through various screens and states. Includes happy paths, error states, and alternative flows (like OAuth). Shows decision points, state transitions, and system responses.

**Reference**: `ideas/ux-designer-idea.md`

#### 24. System Architecture Diagrams
Package dependencies and infrastructure visualization using ASCII. Shows how backend packages relate and depend on each other, what each package exports, and dependency direction. Also visualizes AWS architecture with resources and connections, deployment pipelines, and service communication patterns.

**Reference**: `ideas/ux-designer-idea.md`

#### 25. Git-Based Design System
All ASCII documentation stored in git with full version control support. Text-based files are diffable showing exact changes in pull requests. Mergeable with standard conflict resolution. Searchable using grep across all diagrams. Commit messages follow conventional commits (e.g., "docs(ui): add settings page diagram").

**Reference**: `ideas/ux-designer-idea.md`

---

## Phase 2: Future Development

### Platform Improvements

#### 26. Backend Package Architecture Refactor
Consolidate architecture by removing separate endpoints directory. All packages contain their own endpoints/controllers, keeping full functionality encapsulated within each package. Enables better feature cohesion and easier extraction to separate services if needed. Evaluate if frontend should follow similar pattern with page-level packages.

**Reference**: `TODO.md` (line 85)

#### 27. CI/CD Pipeline
GitHub Actions workflow implementing defined git strategy (likely Gitflow with main, develop, feature branches). Automated testing on pull requests, linting and type checking, Docker image building and pushing to registry, and automated deployment to development environment. Includes rollback capabilities and deployment approval gates.

**Reference**: `TODO.md` (lines 87-88)

#### 28. Centralized Logging Configuration
Structured logging standardized across all projects. Pino logger with consistent format including correlation IDs, request context, and structured fields. Log levels configurable per environment. Integration with Loki for aggregation and Grafana for querying.

**Reference**: `TODO.md` (lines 90-91)

### Multi-Platform Expansion

#### 29. Angular Frontend
Enterprise-focused frontend alternative using Angular framework. Provides opinionated structure with TypeScript, RxJS, and dependency injection. Targets organizations preferring Angular's conventions and enterprise features. Shares backend API with React frontend.

**Reference**: `TODO.md` (line 93)

#### 30. React Native/Expo Mobile App
Native mobile application for iOS and Android using React Native and Expo. Provides mobile-optimized UI with native navigation patterns, push notifications, offline support, and biometric authentication. Shares backend API and real-time WebSocket infrastructure.

**Reference**: `TODO.md` (line 95)

#### 31. Electron Desktop App
Cross-platform desktop application for Windows, macOS, and Linux using Electron. Provides native menu bar, keyboard shortcuts, system tray integration, and local file system access. Useful for power users needing desktop-specific features. Shares web UI codebase with containerized approach.

**Reference**: `TODO.md` (line 97)

---

## Feature Status Legend

- 🚀 **Active**: Feature is currently being developed
- 🔮 **Planned**: Feature is defined and scheduled for future development
- 💡 **Idea**: Feature concept exists in ideas/ directory but not yet scheduled

---

## Related Documentation

- **Detailed Design Docs**: See `ideas/` directory
- **Research & Concepts**: See `claude-automation-research/` directory
- **Architecture Docs**: See `docs/` directory
- **Plugin Documentation**: See `.claude-plugin/decomp-dev/` directory

---

**Last Updated**: 2026-01-12
