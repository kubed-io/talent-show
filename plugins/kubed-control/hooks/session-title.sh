#!/usr/bin/env bash
# Claude Code hook (Stop, SessionStart): publishes the session's title as the gauge
# claude_code_session_title{session_id, title} so dashboards can name sessions.
# The telemetry itself only carries session ids. Ships in the kubed-control plugin.
#
# A /rename writes a custom-title entry to the transcript and wins over Claude's own
# ai-title. The value is the send time, so the newest title per session is the max.
# Hooks get no OTEL_* variables from Claude Code, hence $KUBED_OTLP_METRICS_ENDPOINT; unset,
# the hook does nothing.
#
# Sends only when the title changed, on session start, or when the last send is over a
# day old. That last one keeps a long-open session inside Prometheus' ~10 day retention,
# which the dashboard's [10d] title lookback depends on.

endpoint="${KUBED_OTLP_METRICS_ENDPOINT:-}"
state_dir="${CLAUDE_PLUGIN_DATA:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hooks}/.session-titles"

input=$(cat)
[ -n "$endpoint" ] || exit 0
session=$(printf '%s' "$input" | grep -oE '"session_id":"[^"]+"' | head -1 | cut -d'"' -f4)
transcript=$(printf '%s' "$input" | grep -oE '"transcript_path":"[^"]+"' | head -1 | cut -d'"' -f4)
event=$(printf '%s' "$input" | grep -oE '"hook_event_name":"[^"]+"' | head -1 | cut -d'"' -f4)
[ -n "$session" ] && [ -f "$transcript" ] || exit 0

# anchored on the line start: titles quoted inside conversation text never match
title=$(grep '^{"type":"custom-title",' "$transcript" | tail -1 | grep -oE '"customTitle":"([^"\\]|\\.)*"')
source=custom
if [ -z "$title" ]; then
  title=$(grep '^{"type":"ai-title",' "$transcript" | tail -1 | grep -oE '"aiTitle":"([^"\\]|\\.)*"')
  source=ai
fi
[ -n "$title" ] || exit 0
title=${title#*:\"}   # still JSON-escaped, so it drops straight into the body below
title=${title%\"}

mkdir -p "$state_dir"
state="$state_dir/$session"
if [ "$event" != SessionStart ] && [ "$(cat "$state" 2>/dev/null)" = "$source:$title" ] \
  && [ -n "$(find "$state" -mmin -1440 2>/dev/null)" ]; then
  exit 0
fi
[ "$event" = SessionStart ] && find "$state_dir" -type f -mtime +30 -delete 2>/dev/null

now=$(date +%s%N)
body='{"resourceMetrics":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"claude-code"}}]},"scopeMetrics":[{"scope":{"name":"session-title-hook"},"metrics":[{"name":"claude_code.session.title","gauge":{"dataPoints":[{"attributes":['
body+='{"key":"session.id","value":{"stringValue":"'"$session"'"}},'
body+='{"key":"title","value":{"stringValue":"'"$title"'"}},'
body+='{"key":"title.source","value":{"stringValue":"'"$source"'"}}'
body+='],"timeUnixNano":"'"$now"'","asInt":"'"${now:0:10}"'"}]}}]}]}]}'

# detached so the reply is never held up; unreachable collector (devcontainer) is a no-op.
# The state is written only after a successful send, so a failed one is retried next turn.
( curl -sf -m 2 -o /dev/null -H 'Content-Type: application/json' --data-binary "$body" "$endpoint" \
  && printf '%s' "$source:$title" > "$state" ) </dev/null >/dev/null 2>&1 &
exit 0
