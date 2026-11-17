#!/usr/bin/env bash
# Approves every tool call in a session that started as one of this plugin's agents, its
# subagents included: there no one can answer a permission prompt, and each agent's `tools`
# list decides what it may use. Any other session keeps the normal permission checks, so
# turning the plugin on without an entry agent approves nothing. Deny rules and
# --disallowedTools still apply.
#   SessionStart: remembers the session when agent_type is kubed-runner:<agent>
#   PreToolUse:   approves when the session was remembered
input=$(cat)
field() { printf '%s' "$input" | grep -oE "\"$1\": *\"[^\"]+\"" | head -1 | sed -E 's/.*: *"([^"]+)"/\1/'; }
event=$(field hook_event_name)
session=$(field session_id)
[ -n "$session" ] || exit 0
dir="${CLAUDE_PLUGIN_DATA:-${TMPDIR:-/tmp}/kubed-runner}/entry-sessions"

case "$event" in
SessionStart)
  case "$(field agent_type)" in
  kubed-runner:*)
    mkdir -p "$dir" && : > "$dir/$session"
    find "$dir" -type f -mtime +7 -delete 2>/dev/null ;;
  esac ;;
PreToolUse)
  [ -f "$dir/$session" ] || exit 0
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","permissionDecisionReason":"kubed-runner: the agent'"'"'s tools list decides"}}' ;;
esac
exit 0
