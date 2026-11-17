// kb's side of the mod: the scope, the JSON-RPC envelope, and how a kb agent becomes an
// agent definition. No `$` here, so it can be tested on its own.

import { BASH_HINT } from './skillfiles.ts'

// kb speaks the stateless 2026-07-28 revision: one POST per request, no initialize.
export const PROTOCOL = '2026-07-28'
export const EXTENSION = 'io.modelcontextprotocol/agents'
export const META = 'io.kubed.mcp-kb/agent'

export type Options = {
  url: string
  library: string
  categories: string[]
  tags: string[]
  agents: string[]
  skills: boolean
  timeoutMs: number
  skillsUrl: string
  skillUris: boolean
  // Set by the mod on a runner: the Keycloak token for the agents' kb servers.
  headers?: Record<string, string>
}

export type Card = { name: string; description?: string; capabilities?: string[] }

export type Got = {
  agent: string
  instructions?: string
  modelRoutingHint?: { role?: 'small' | 'medium' | 'large'; vision?: boolean }
  _meta?: Record<string, unknown>
}

type Detail = {
  plugin?: string
  library?: string
  path?: string
  frontmatter?: Record<string, unknown>
  servers?: string[]
}

// A `multiple` option arrives as an array, or as a JSON string when it was set with
// `claude plugin configure --values-stdin`. A plain string is one value: a comma inside a
// tag entry means "all of", so it is never split here.
export function many(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean)
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return many(parsed)
  } catch {
    // not JSON: one value
  }
  return [value.trim()]
}

export function readOptions(options: Readonly<Record<string, unknown>>): Options {
  const timeout = Number(options.timeout_ms)
  return {
    url: String(options.url ?? '').trim(),
    library: String(options.library ?? '').trim(),
    categories: many(options.categories),
    tags: many(options.tags),
    agents: many(options.agents),
    skills: options.skills !== false && options.skills !== 'false',
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 5000,
    skillsUrl: String(options.skills_url ?? '').trim(),
    skillUris: options.skill_uris !== false && options.skill_uris !== 'false',
  }
}

// The runner's MCP sign-in, the same contract as kubed-runner's bin/mcp-headers: the client is
// $KUBED_MCP_CLIENT, a runner mounts its secret, and $MCP_OIDC_ENDPOINT grants a
// client-credentials token. Not a *_TOKEN_URL: Claude Code withholds variables named like
// credentials.
export const secretPath = (client: string) => `/var/run/secrets/keycloak/${client}/client_secret`

export function tokenRequest(client: string, secret: string) {
  const form: [string, string][] = [
    ['grant_type', 'client_credentials'],
    ['client_id', client],
    ['client_secret', secret.trim()],
    ['scope', 'mcp'],
  ]
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&'),
  }
}

// The scope rides the URL: a repeated parameter is "any of", which a header map can't say.
export function withQuery(url: string, params: [string, string][]): string {
  if (!params.length) return url
  const query = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
  return url + (url.includes('?') ? '&' : '?') + query
}

export function scopeUrl(o: Options): string {
  const params: [string, string][] = []
  if (o.library) params.push(['library', o.library])
  for (const c of o.categories) params.push(['category', c])
  for (const t of o.tags) params.push(['tag', t])
  return withQuery(o.url, params)
}

export function request(method: string, params: Record<string, unknown>, id: number) {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': PROTOCOL,
      'Mcp-Method': method,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params: {
        ...params,
        _meta: {
          'io.modelcontextprotocol/protocolVersion': PROTOCOL,
          'io.modelcontextprotocol/clientCapabilities': { extensions: { [EXTENSION]: {} } },
        },
      },
    }),
  }
}

// The body is JSON, or an SSE stream whose last `data:` line is the answer.
export function parse(method: string, text: string): any {
  let raw = text.trim()
  if (!raw.startsWith('{')) {
    const data = raw.split('\n').filter(l => l.startsWith('data:'))
    raw = (data.pop() ?? '').slice(5).trim()
  }
  let message: any
  try {
    message = JSON.parse(raw)
  } catch {
    throw new Error(`${method}: kb answered something that isn't JSON-RPC: ${text.slice(0, 200)}`)
  }
  if (message.error) {
    const { code, message: why } = message.error
    if (code === -32601) throw new Error(`${method}: this kb doesn't serve agents yet`)
    throw new Error(`${method}: ${why} (${code})`)
  }
  return message.result
}

// Agent type names take letters, digits, `_` and `-`, up to 64. kb's renamed clash
// (`<library>_<name>@<plugin>`) is the one name it serves outside that.
export function agentName(kbName: string): string {
  return kbName.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 64)
}

const ROLE_MODEL = { small: 'haiku', medium: 'sonnet', large: 'opus' } as const

function names(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') return value.split(',').map(s => s.trim()).filter(Boolean)
  return undefined
}

// A kb agent as an agent definition. Like a plugin's agent file in Claude Code, its own
// `mcpServers`, `hooks`, `permissionMode` and `initialPrompt` are dropped: the definition
// comes from a remote catalogue, so it decides prompt, model and tools, not what runs.
export function toSpec(card: Card, got: Got, o: Options) {
  const detail = (got._meta?.[META] ?? {}) as Detail
  const fm = detail.frontmatter ?? {}
  const role = got.modelRoutingHint?.role
  const spec: Record<string, unknown> = {
    name: agentName(card.name),
    description: card.description ?? String(fm.description ?? card.name),
    prompt: got.instructions ?? '',
  }
  const tools = names(fm.tools)
  if (tools) spec.tools = tools
  const disallowed = names(fm.disallowedTools)
  if (disallowed) spec.disallowedTools = disallowed
  const model = typeof fm.model === 'string' ? fm.model : role ? ROLE_MODEL[role] : undefined
  if (model) spec.model = model
  for (const key of ['effort', 'maxTurns', 'autoCompactWindow', 'memory', 'background', 'omitClaudeMd'] as const) {
    if (fm[key] !== undefined) spec[key] = fm[key]
  }
  const skills = names(fm.skills)
  if (skills) spec.skills = skills
  if (fm.isolation === 'worktree') spec.isolation = 'worktree'

  // kb's skills reach a background subagent only as tools, so the agent gets its own
  // library's skills through a server of its own (`?resources=off`), through agentgateway
  // like the runner's other kb servers.
  if (o.skills && o.skillsUrl && detail.library) {
    const url = withQuery(o.skillsUrl, [['library', detail.library], ['resources', 'off'], ['prompts', 'off']])
    const server: Record<string, unknown> = { type: 'http', url }
    if (o.headers) server.headers = o.headers
    spec.mcpServers = [{ 'kb-skills': server }]
    spec.prompt +=
      `\n\nYour skills are not in the Skill tool: they are on the kb-skills server. Read a skill ` +
      `named <plugin>:<skill> with its read_resource at skill://${detail.library}/<skill>/SKILL.md; ` +
      `skill://${detail.library}/_index.md lists them.`
  }
  // In the agent's own prompt: the organization's sec-default skips every hook that adds context.
  if (o.skillUris) spec.prompt += `\n\n${BASH_HINT}`
  return spec
}
