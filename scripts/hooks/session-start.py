#!/usr/bin/env python3
"""
SessionStart Hook - Captures session info when an agent session begins.

Environment variables expected (set by our backend):
  - CLAUDE_AGENT_NAME: Name of the agent (e.g., "decomp", "brainstorm")
  - CLAUDE_PLAN_DIR: Path to the plan directory (e.g., ".backlog/p-abc123")

Creates session directory structure:
  {plan_dir}/sessions/{agent_name}-{session_short_id}/
    session.json - Session metadata
"""

import json
import sys
import os
from datetime import datetime


def main():
    # Read hook input from stdin
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        # No input or invalid JSON, just exit cleanly
        print(json.dumps({}))
        return

    session_id = input_data.get("session_id", "")
    transcript_path = input_data.get("transcript_path", "")
    cwd = input_data.get("cwd", "")
    source = input_data.get("source", "startup")

    # Get agent info from environment
    agent_name = os.environ.get("CLAUDE_AGENT_NAME")
    plan_dir = os.environ.get("CLAUDE_PLAN_DIR")

    # If no agent name set, this isn't one of our managed sessions
    if not agent_name:
        print(json.dumps({}))
        return

    # Try to resolve plan_dir if not set but cwd is in .backlog
    if not plan_dir and ".backlog/" in cwd:
        try:
            parts = cwd.split(".backlog/")
            if len(parts) > 1:
                plan_id = parts[1].split("/")[0]
                plan_dir = os.path.join(parts[0], ".backlog", plan_id)
        except Exception:
            pass

    if not plan_dir:
        print(json.dumps({}))
        return

    # Create unique session directory name: {agent_name}-{short_id}
    short_id = session_id[:6] if len(session_id) >= 6 else session_id
    session_dir_name = f"{agent_name}-{short_id}"
    sessions_dir = os.path.join(plan_dir, "sessions", session_dir_name)

    try:
        os.makedirs(sessions_dir, exist_ok=True)

        # Write session metadata
        session_file = os.path.join(sessions_dir, "session.json")
        session_data = {
            "session_id": session_id,
            "agent_name": agent_name,
            "started_at": datetime.now().isoformat(),
            "source": source,
            "transcript_path": transcript_path,
            "plan_dir": plan_dir,
            "session_dir": session_dir_name,
            "status": "active"
        }

        with open(session_file, "w") as f:
            json.dump(session_data, f, indent=2)

        # Also write the session dir name to a "current" pointer file
        # This helps the stop hook find the right session
        current_file = os.path.join(plan_dir, "sessions", f".current-{agent_name}")
        with open(current_file, "w") as f:
            f.write(session_dir_name)

    except Exception as e:
        # Log error but don't fail the session
        print(f"Warning: Failed to write session info: {e}", file=sys.stderr)

    # Return empty response (no special context to inject)
    print(json.dumps({}))


if __name__ == "__main__":
    main()
