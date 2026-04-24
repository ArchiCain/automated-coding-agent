# Diagrams

All diagrams in this repo live **inline in Markdown**. Two formats are
supported:

## Mermaid (primary)

Use Mermaid for anything non-trivial — architecture, sequences, flows,
state machines, data models. GitHub, VS Code, JetBrains, and most
Markdown previewers render it natively; the source stays grep-able and
diff-friendly in PRs.

Fenced with `mermaid`:

    ```mermaid
    flowchart LR
      A[User] --> B[Gateway]
      B --> C[(Database)]
    ```

Picking a diagram type:

| Use case | Type |
|---|---|
| Boxes + arrows (architecture, deploy paths) | `flowchart` |
| Time-ordered interactions between actors | `sequenceDiagram` |
| Lifecycle of a single thing (sandbox, job, task) | `stateDiagram-v2` |
| DB schemas and relationships | `erDiagram` |
| Class / interface structure | `classDiagram` |

## ASCII (quick sketches)

Use ASCII when the diagram is ~5 boxes, disposable, and the author just
wants to show shape fast — e.g., a one-off illustration inside a longer
doc. Past ~5 boxes or any non-linear flow, switch to Mermaid; alignment
gets tedious and agents regenerate ASCII less reliably.

Fenced with a plain code block:

    ```
    [laptop] --ssh--> [host-machine] --> [Ollama]
                                 `----> [compose stack]
    ```

## What not to use

- No Excalidraw / Figma / Draw.io. Binary-ish formats aren't
  diff-friendly, agents can't edit them, and they require opening a
  separate tool.
- No PlantUML. Needs a renderer GitHub doesn't ship natively and adds
  tooling cost for humans + agents without a clear win over Mermaid.
- No inline images of diagrams. If a Mermaid source would work, use it —
  text beats PNG for every reason that matters here.
