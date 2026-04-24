# THE Dev Team — FROZEN reference

**Do not edit.** This project is not actively worked on.

## Status

THE Dev Team was the first orchestrator built for this monorepo — a NestJS + Mastra + Claude-Agent-SDK stack that wrote code against `.docs/` specs. It has been retired in favor of **OpenClaw** (see `projects/openclaw/`), which is now the active agent runtime.

- **Not runnable.** The Helm chart was deleted in the k8s → Docker Compose migration; no compose-project equivalent was built. The source compiles but has no deployment path.
- **Kept as reference.** The NestJS orchestration patterns (agent spawning, task graph, WebSocket streaming, sandbox coordination) are still worth reading if you're designing something similar.
- **Not cleaned up.** Its source still imports `@kubernetes/client-node`, references minikube in task-runner types, etc. Rewriting those is out of scope — freezing it is cheaper than unwinding.

## If you want to change something here

Stop. Figure out what you actually want:

- **Fix a behavior of the active agent runtime?** → Edit `projects/openclaw/` (skills, prompts, docker image).
- **Fix a bug in the benchmark app?** → That's OpenClaw's queue. Open an issue or talk to the OpenClaw orchestrator at `http://localhost:3001`.
- **Retire the-dev-team entirely?** → Delete this whole directory. Grep for remaining references (there may be some in `.docs/standards/` or `projects/README.md`) and clean those up too.

See the top of `CLAUDE.md` for the division of labor.
