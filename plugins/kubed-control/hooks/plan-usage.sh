#!/usr/bin/env bash
# Claude Code hook (Stop): publishes the subscription's real usage as OpenTelemetry gauges.
#
#   claude_code_rate_limit_utilization{window}  used share, 0-1
#   claude_code_rate_limit_resets_at{window}    when the window resets, epoch seconds
#
# window: five_hour, seven_day, and seven_day_<model> for a model's own weekly limit (Fable).
#
# Hooks never see these numbers, so it asks for them: the SDK's get_usage control request in a
# headless `claude -p`. That reads the plan's usage endpoint, the same as /usage, with no model
# call and no tokens. Account-wide, so no session label. At most every 5 minutes, detached.

# The OTLP/HTTP metrics endpoint; unset, the hook does nothing.
endpoint="${KUBED_OTLP_METRICS_ENDPOINT:-}"
stamp="${CLAUDE_PLUGIN_DATA:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hooks}/.plan-usage"

# the probe is itself a session: its own hooks must not start another
[ -z "${KUBED_PLAN_USAGE_PROBE:-}" ] || exit 0
cat >/dev/null
[ -n "$endpoint" ] || exit 0
command -v claude >/dev/null && command -v jq >/dev/null || exit 0

mkdir -p "${stamp%/*}"
[ -n "$(find "$stamp" -mmin -5 2>/dev/null)" ] && exit 0
touch "$stamp"   # claimed before the probe, so concurrent sessions don't all probe at once

probe() {
  local request='{"type":"control_request","request_id":"u","request":{"subtype":"get_usage"}}'
  local body
  body=$(printf '%s\n' "$request" \
    | KUBED_PLAN_USAGE_PROBE=1 timeout 30 claude -p --input-format stream-json \
        --output-format stream-json --verbose --no-session-persistence \
        --strict-mcp-config --settings '{"disableAllHooks":true}' 2>/dev/null \
    | jq -c --arg now "$(date +%s%N)" '
      select(.type == "control_response") | .response.response
      # resets_at is ISO with microseconds and an offset; all of them are UTC
      | def epoch: .[0:19] + "Z" | fromdateiso8601;
        def point($window; $value):
          {attributes: [{key: "window", value: {stringValue: $window}}],
           timeUnixNano: $now} + $value;
        [ (.rate_limits | to_entries[]
            | select(.key == "five_hour" or .key == "seven_day")
            | select(.value.utilization != null) | {window: .key} + .value),
          (.rate_limits.model_scoped // [] | .[] | select(.utilization != null)
            | {window: ("seven_day_" + (.display_name | ascii_downcase))} + .)
        ] as $w
      | select($w | length > 0)
      | {resourceMetrics: [{
          resource: {attributes: [{key: "service.name", value: {stringValue: "claude-code"}}]},
          scopeMetrics: [{scope: {name: "plan-usage-hook"}, metrics: [
            {name: "claude_code.rate_limit.utilization", gauge: {dataPoints:
              [$w[] | point(.window; {asDouble: (.utilization / 100)})]}},
            {name: "claude_code.rate_limit.resets_at", gauge: {dataPoints:
              [$w[] | point(.window; {asInt: (.resets_at | epoch | tostring)})]}}
          ]}]}]}')
  [ -n "$body" ] || return 0
  curl -sf -m 5 -o /dev/null -H 'Content-Type: application/json' --data-binary "$body" "$endpoint"
}

# detached: the turn never waits on a second Claude Code starting up
( probe ) </dev/null >/dev/null 2>&1 &
exit 0
