Sync the code at $ARGUMENTS (or the current working directory if no path given) to match its `.docs/` specification.

## Instructions

1. **Find and read the `.docs/` directory.** Read spec.md, flows.md, and contracts.md. Do NOT read test-plan.md or test-data.md — those are for the tester, not you.

2. **Read project-level docs.** Walk up to find the nearest project-level `.docs/` with overview.md and standards/. Read standards/coding.md and standards/design.md (if frontend) to understand conventions.

3. **Read the source code.** Read the feature's existing code. Start with index/barrel files, then the files relevant to the spec. Use search before reading entire directories.

4. **Identify deltas.** Compare what the spec says should exist vs what the code does. List the gaps.

5. **Make targeted changes.** For each gap:
   - If the spec describes something missing from code → implement it
   - If the code does something the spec doesn't describe → leave it alone (flag it for doc review, don't delete working code)
   - If the code contradicts the spec → fix the code to match the spec
   - Follow the project's coding standards

6. **Commit frequently.** After each logical change (not each file, each logical unit of work):
   - Write a detailed commit message explaining what changed and why
   - Reference the spec criterion being addressed
   - Example: "Add permission guard to /users endpoint — spec requires users:read permission for GET /users"

7. **Run tests if they exist.** After making changes, run any existing tests for the feature. If tests fail, fix the code (not the tests — tests reflect the spec).

8. **Report what you did.** At the end, summarize:
   - What was already in sync
   - What you changed and why
   - What you couldn't address (and why — e.g., "spec is ambiguous about X")
   - What needs doc updates (code behavior not covered by spec)

## Rules
- Never modify `.docs/` files — you sync code TO docs, not the other way around
- Follow existing code patterns in the project
- Be deliberate about what you read — you have a limited context window
- Use offset/limit on large files
- Use search before reading entire directories
