Review the `.docs/` specification at $ARGUMENTS (or the current working directory if no path given) for completeness, clarity, and testability.

## Instructions

1. **Find and read ALL `.docs/` files.** Read every file in the feature's `.docs/` directory.

2. **Read project-level docs.** Walk up to find the nearest project-level `.docs/` with overview.md and standards/. Understand the project context.

3. **Read the source code** (lightly). Skim the feature's code to understand what exists — this helps identify docs that are stale or missing behavior.

4. **Evaluate each doc file:**

   **spec.md:**
   - Does every behavior bullet describe something verifiable?
   - Are acceptance criteria specific enough to write a test against?
   - Is the purpose clear?
   - Are there behaviors in the code not covered by the spec?

   **flows.md** (if present):
   - Are all steps numbered and unambiguous?
   - Do flows cover both happy and error paths?
   - Are API calls specified with method and route?
   - Are state changes explicit?

   **contracts.md** (if present):
   - Do request/response shapes match what the code actually sends/receives?
   - Are all endpoints documented?
   - Are auth requirements specified per endpoint?

   **test-plan.md** (if present):
   - Does every acceptance criterion have at least one test?
   - Do test scenarios cover error paths, not just happy paths?
   - Are expected outcomes specific (status codes, response shapes, UI states)?

   **test-data.md** (if present):
   - Is the data sufficient to run all tests in test-plan.md?
   - Are credentials, seed data, and API examples complete?

5. **Check for missing files:**
   - No spec.md? → Critical gap, every feature needs one
   - No flows.md but feature has multi-step behavior? → Should have one
   - No contracts.md but feature crosses a boundary? → Should have one
   - No test-plan.md but feature is testable? → Should have one
   - No test-data.md but tests need specific data? → Should have one

6. **Output a structured report:**

```
## Spec Review: {feature name}

### Files Present
- [x] spec.md
- [ ] flows.md (MISSING — this feature has multi-step auth flows)
- [x] contracts.md
- [ ] test-plan.md (MISSING)
- [ ] test-data.md (MISSING — auth features need test credentials)

### spec.md Quality
| Criterion | Testable? | Issue |
|-----------|-----------|-------|
| "Users can log in" | Too vague | Should specify: method, endpoint, success response, error cases |
| "GET /users returns paginated list" | Good | Clear and verifiable |

### Recommendations
1. {Specific improvement with example of what good looks like}
2. {Missing doc file with outline of what it should contain}
```

Be specific and actionable. Don't just say "needs more detail" — show what the detail should look like.
