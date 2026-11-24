# talent-show

**Claude Code plugins for the tools we actually use, in one marketplace.** Most plugins are one
tool's worth of know-how: the traps, the cheap way to do things, and where the docs live. A few are
hooks and agents for our own sessions.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

```
/plugin marketplace add kubed-io/talent-show
/plugin install drawio@talent-show
```

Or skip installing: anything that reads skills over MCP, or straight from a git repo, can load the
same folders.

---

## 🎨 drawio

Draw and edit [draw.io](https://www.drawio.com) diagrams. With
[lgazo/drawio-mcp-server](https://github.com/lgazo/drawio-mcp-server) connected, the agent works in
the diagram you have open: one new box, one re-pointed arrow, while you watch. No editor? It writes a
`.drawio` file instead.

- **Small edits, small bills.** It reads only the cells it needs, checks its work as XML instead of
  images, and skips the editor's traps (an import that wipes the page, an export path on someone
  else's disk). In testing, adding a cache to a diagram took less than half the time and a third of
  the tool traffic.
- **Prompts for the everyday asks.** `/drawio:draw`, `edit`, `tidy`, `explain` — and `note`, which
  files what a session learned back into the skill.
- **Real icons, not guesses.** Kubernetes, AWS, GCP and Azure styles that render, instead of
  confidently named empty boxes.
- **A map of the docs.** Every style key, shape index, file format and API — with the cheap way to
  fetch each one.
- **Hand off the whole diagram.** The `drawio:diagrammer` subagent draws it in its own context, so the
  main conversation gets a two-line report instead of thirty tool calls.
- **Grows as you use it.** One reference file per kind of diagram. Learn something, add a line.

[`plugins/drawio`](plugins/drawio/skills/drawio/SKILL.md)

---

## ⚡ ultrapowers

The turns of an issue-to-pull-request agent flow, as prompts on top of
[superpowers](https://github.com/obra/superpowers). Each one starts a turn from an event with no words
of its own: a label, a push, a review, red checks.

- **From issue to plan.** `spec-draft` drafts the spec by brainstorming; `spec-approved` writes the
  plan of record by writing-plans.
- **A task at a time.** `plan-approved` and `next-task` build the plan by subagent-driven
  development, one task per turn.
- **Answers, not excuses.** `checks-failed` debugs red checks; `review-came-in` answers every open
  review thread by receiving-code-review.
- **A review with a security pass.** `review` reviews the whole branch, after a subagent
  security-reviews the diff.
- **A bug, assessed, then fixed.** `debug-report` finds what happens and why by systematic
  debugging, from the code and the live system, and reports the evidence, the cause and a fix;
  `fix-approved` builds that fix test-first once the report is approved, with no plan.
- **One issue, in parts.** `make-sub-issue` writes a sub-issue Dr K accepted, as its form asks;
  `sub-issue` starts one; `sub-issue-added` fits in one Dr K added; `sub-issue-closed` reviews
  what merged and realigns the family when one closes.
- **A family that runs itself.** `review-sub-issue` reviews a sub-issue's change, and a pass merges
  it into the family's branch; `sub-issue-reported` reads a sub-issue's report, or a stalled
  review, and decides what's next, approving specs and plans for Dr K; `parent-message` answers
  the parent on a sub-issue.
- **Renovate, followed up.** `renovate-opened` works out what a bump needs beyond the version,
  makes it and proves the build diff, then approves or asks; `renovate-comment` answers Dr K and
  changes what he asked; `renovate-updated` redoes the follow-up after Renovate pushes.

[`plugins/ultrapowers`](plugins/ultrapowers/commands)

---

## 🪝 Hooks and agents

Plugins that run code in a session, not skills. Every address they need comes from an env var or a
plugin option, so nothing here names a host.

| Plugin | What it adds | Needs |
|---|---|---|
| [`kubed-control`](plugins/kubed-control) | Each session's title, and the plan's real 5-hour and weekly usage, as OpenTelemetry metrics | `KUBED_OTLP_METRICS_ENDPOINT` |
| [`kubed-runner`](plugins/kubed-runner) | A runner's entry agents (`spec`, `plan`, `code`, `review`, `debug`, `info`, `renovate`), the MCP servers they may use, and a hook that approves every call their `tools` list allows. Off until a run turns it on | `KUBED_MCP_URL`, `KUBED_MCP_CLIENT`, `MCP_OIDC_ENDPOINT` |
| [`kb-agents`](plugins/kb-agents) | A mod: kb's agents as subagents, picked by library, category and tag | the `url` option |

```bash
claude -p --settings '{"agent":"kubed-runner:code","enabledPlugins":{"kubed-runner@talent-show":true}}'
```

To work on one, start a session with `claude --plugin-dir plugins/<plugin>`: that copy wins over the
installed one, and `/reload-plugins` picks up edits.

---

## Adding a plugin

One folder under `plugins/`, one entry in [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json).
[AGENTS.md](AGENTS.md) has the conventions.
