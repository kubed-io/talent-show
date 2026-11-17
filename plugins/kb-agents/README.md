# kb-agents

A mod that loads the subagents kb serves, when a session starts. Each one becomes
`kb-agents:<kb name>`, with kb's prompt, model and tools, and kb's skills of its own library as
tools. `/kb-agents` loads them again.

It reads kb through the draft agents extension (`agents/list`, `agents/get`), kubed-io/mcp-kb#33.

## Options

| Option | What it does |
|---|---|
| `url` | Where the agents come from: kb in-cluster, since agentgateway refuses the agents methods |
| `library` | One library |
| `categories` | Any of these categories |
| `tags` | Any of these entries; `a,b` in one entry means both |
| `agents` | Only these kb names |
| `skills` | Give each agent its library's skills (default on) |
| `skills_url` | kb through agentgateway, for those skills |
| `skill_uris` | Let a Bash command name a skill's file by its `skill://` URI (default on) |
| `timeout_ms` | How long the start waits for kb (default 5000) |

A run sets them with `--settings`:

```json
{
  "enabledPlugins": {"kb-agents@talent-show": true},
  "pluginConfigs": {"kb-agents@talent-show": {"options": {"url": "https://kb.example.com/mcp", "library": "drawio"}}}
}
```

On a runner the skills servers sign in as kubed-runner's `bin/mcp-headers` does: `KUBED_MCP_CLIENT`,
the client's mounted secret, and `MCP_OIDC_ENDPOINT`, the token endpoint. The mod loads again
before the token runs out.

A skill's scripts run where they are served: `python3 skill://drawio/drawio/scripts/check.py f`
runs a copy fetched into the session's scratchpad just before the command. The file comes from the
server the model read that skill from, else one whose listing serves its library, else kb. Text
files only. Each kb agent's prompt says so.

Under `--strict-mcp-config` the agents run without their kb skills.
