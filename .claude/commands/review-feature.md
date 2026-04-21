Review the feature at $ARGUMENTS (or the current working directory if no path given) by comparing its `.docs/` specification against the actual code.

## Instructions

1. **Find the `.docs/` directory.** Look in the target directory first, then walk up one level. If no `.docs/` exists, report that and stop.

2. **Read all spec files.** Read every file in `.docs/` — spec.md, flows.md, contracts.md, test-plan.md, test-data.md, decisions.md. Not all will exist; that's fine.

3. **Read project-level docs.** Walk up from the feature directory to find the nearest project-level `.docs/` (the one with overview.md and/or standards/). Read overview.md and any standards files to understand conventions.

4. **Read the source code.** Read the feature's source files. Be deliberate — start with index/barrel files, then read the files referenced by the spec. Don't read every file if the feature is large; focus on what the spec describes.

5. **Compare and report.** For each acceptance criterion in spec.md:
   - Does the code implement it? (implemented / missing / partial)
   - Is the implementation correct per the flows?
   - Does the contract match between frontend and backend (if contracts.md exists)?

6. **Identify doc gaps.** Report:
   - Missing files (e.g., "No flows.md — this feature has multi-step behavior and should have one")
   - Acceptance criteria that are vague or untestable
   - Code behavior not covered by any spec
   - Stale docs that describe something the code no longer does

7. **Output a structured report:**

```
## Feature Review: {feature name}

### Spec Coverage
| Criterion | Status | Notes |
|-----------|--------|-------|
| ... | Implemented / Missing / Partial / Stale | ... |

### Doc Gaps
- {what's missing and why it matters}

### Code Not in Spec
- {behavior that exists in code but isn't documented}

### Recommendations
- {specific, actionable next steps}
```

Be concise. Focus on gaps and differences, not on confirming things that are fine.
