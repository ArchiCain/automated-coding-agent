#!/usr/bin/env python3
"""
Stop Hook - Copies session transcript when an agent session ends.

This hook:
1. Checks stop_hook_active to prevent infinite loops
2. Finds the current session directory (created by session-start hook)
3. Copies the transcript file to the session directory
4. Updates session.json with completion status

Environment variables expected:
  - CLAUDE_AGENT_NAME: Name of the agent (e.g., "decomp", "brainstorm")
  - CLAUDE_PLAN_DIR: Path to the plan directory (e.g., ".backlog/p-abc123")
"""

import json
import sys
import os
import shutil
from datetime import datetime


def main():
    # Read hook input from stdin
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        print(json.dumps({}))
        return

    # Check if this is already a hook-triggered continuation
    stop_hook_active = input_data.get("stop_hook_active", False)
    if stop_hook_active:
        # Let the session stop to prevent infinite loop
        print(json.dumps({}))
        return

    transcript_path = input_data.get("transcript_path", "")
    cwd = input_data.get("cwd", "")

    # Get agent info from environment
    agent_name = os.environ.get("CLAUDE_AGENT_NAME")
    plan_dir = os.environ.get("CLAUDE_PLAN_DIR")

    # If no agent name set, this isn't one of our managed sessions
    if not agent_name:
        print(json.dumps({}))
        return

    # Try to resolve plan_dir if not set
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

    # Find the current session directory
    current_file = os.path.join(plan_dir, "sessions", f".current-{agent_name}")
    if not os.path.exists(current_file):
        print(json.dumps({}))
        return

    try:
        with open(current_file, "r") as f:
            session_dir_name = f.read().strip()

        sessions_dir = os.path.join(plan_dir, "sessions", session_dir_name)
        if not os.path.exists(sessions_dir):
            print(json.dumps({}))
            return

        # Copy transcript to session directory
        if transcript_path and os.path.exists(transcript_path):
            dest_transcript = os.path.join(sessions_dir, "transcript.jsonl")
            shutil.copy2(transcript_path, dest_transcript)

        # Update session.json with completion info
        session_file = os.path.join(sessions_dir, "session.json")
        if os.path.exists(session_file):
            with open(session_file, "r") as f:
                session_data = json.load(f)

            session_data["ended_at"] = datetime.now().isoformat()
            session_data["status"] = "completed"
            session_data["transcript_saved"] = True

            with open(session_file, "w") as f:
                json.dump(session_data, f, indent=2)

        # Clean up the current pointer file
        os.remove(current_file)

    except Exception as e:
        # Log error but don't fail
        print(f"Warning: Failed to save transcript: {e}", file=sys.stderr)

    # Allow the session to stop
    print(json.dumps({}))


if __name__ == "__main__":
    main()
