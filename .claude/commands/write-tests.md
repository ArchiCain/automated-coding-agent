Write tests for the feature at $ARGUMENTS (or the current working directory if no path given) based on its `.docs/` specification.

## Instructions

1. **Find and read the `.docs/` directory.** Read ALL doc files — spec.md, flows.md, contracts.md, test-plan.md, test-data.md. The test-plan.md is your primary playbook. If it doesn't exist, you'll create it.

2. **Read project-level docs.** Walk up to find the nearest project-level `.docs/` with overview.md and standards/. Understand the testing patterns used in this project.

3. **Read existing tests.** Search for existing test files in the feature directory and nearby. Understand the testing framework, file naming, and patterns already in use (Jest, Vitest, Playwright, etc.).

4. **Read the source code.** Read enough of the feature's code to understand the implementation — you need to know function signatures, route paths, component props, service methods, etc.

5. **Create or update test-plan.md.** If `.docs/test-plan.md` doesn't exist, create it:
   - Map each acceptance criterion from spec.md to at least one test
   - Map each flow from flows.md to at least one E2E scenario
   - Map each contract from contracts.md to contract tests
   - Structure: Contract Tests → Behavior Tests → E2E Scenarios

6. **Write the test code.** Create test files following the project's patterns:

   **Contract tests** (from contracts.md):
   - Verify API response shapes match the contract
   - Verify required fields, correct types, status codes
   - These are deterministic — they should never be flaky

   **Behavior tests** (from spec.md acceptance criteria):
   - One test per acceptance criterion minimum
   - Assert behavior, not implementation details
   - Don't assert exact strings unless the spec specifies exact strings
   - Don't assert timestamps, IDs, or other generated values

   **E2E tests** (from flows.md):
   - Full user journeys against a running instance
   - Use test-data.md for concrete inputs
   - Only write these if the project has E2E infrastructure (Playwright setup, etc.)

7. **Run the tests.** Execute the test suite. Some tests SHOULD fail if the feature is incomplete — that's TDD. Report which pass and which fail.

8. **Commit.** Commit the test-plan.md and test files with a descriptive message.

## Rules
- Tests verify the SPEC, not the current implementation
- If a test would pass regardless of whether the feature works, it's too generic — make it specific
- If a test asserts implementation internals (private methods, internal state), it's too specific — assert observable behavior
- Use test-data.md values for concrete test inputs — don't invent data
- Follow the project's existing test patterns and framework
