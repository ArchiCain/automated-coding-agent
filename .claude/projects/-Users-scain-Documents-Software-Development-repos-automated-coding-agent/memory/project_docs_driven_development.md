---
name: Documentation-Driven Development Model
description: The documentation IS the specification — change the docs first, agents make the code match. Docs live with the project, serve as requirements + tests + onboarding. Future web UI for change requests.
type: project
---

Documentation-driven development: the docs are the source of truth, not the code. To change the system, you change the docs, then agents implement the delta. Docs are always current because they drove the implementation.

**Why:** Collapses requirements, documentation, and test plans into a single artifact. Eliminates the "update docs after shipping" step that everyone skips. Enables a future web UI where humans fill in structured change requests (editing docs) and agents execute them.

**How to apply:**
- Docs live WITH the project (e.g. `projects/application/frontend/docs/`)
- Structure: `pages/{name}/requirements.md, components.md, flows.md, test-data.md` + `shared/{feature}/` + `standards/`
- If code doesn't match docs, the code is wrong
- Feature READMEs (in src/) cover "how" (technical integration); docs/ covers "what and why" (requirements, flows, verification)
- flows.md files are executable test plans — designer agents follow them step-by-step in Playwright
- test-data.md files are seed data + edge cases
- Future: web UI presenting docs in structured form, humans fill in change requests, agent fills in details conversationally, screenshots/mermaid diagrams supported
- This is the communication layer between humans and agents
