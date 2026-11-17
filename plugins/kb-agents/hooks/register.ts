import type { Register } from 'claude-code'
import {
  type Card,
  type Got,
  type Options,
  parse,
  readOptions,
  request,
  scopeUrl,
  secretPath,
  tokenRequest,
  toSpec,
  withQuery,
} from './kb.ts'
import {
  bare,
  learnedKeys,
  libraryOf,
  listingServers,
  localPath,
  lookup,
  readToolCall,
  resourceText,
  isSkillUri,
  rewriteCommand,
  skillUris,
  toolText,
} from './skillfiles.ts'

// The agent types the last load registered. A type can't be unregistered, so one that has
// left kb's roster since is hidden from the model instead (agent.offer, below).
let loaded = new Set<string>()
let id = 0
// The next load, before the token it signed in with runs out.
let refresh: { cancel: () => void } | undefined
// The runner's token from the last sign-in, for the mod's own reads of kb.
let headers: Record<string, string> | undefined
// Which connected server answered for a skill's folder or library, learned from the model's
// reads. Kept for the session only: server names are this session's config.
const servers = new Map<string, string>()
// Where this session's copies of skill files go: its scratchpad, found once.
let scratch: string | undefined
let launchCwd = ''

async function rpc($: any, o: Options, method: string, params: Record<string, unknown>) {
  const res = await $.http.fetch(scopeUrl(o), request(method, params, ++id))
  return parse(method, res.text)
}

// kb's roster in this scope, then each definition, then one register per agent.
async function load($: any, o: Options): Promise<string> {
  const listed = await rpc($, o, 'agents/list', {})
  const cards: Card[] = (listed?.agents ?? []).filter(
    (c: Card) => !o.agents.length || o.agents.includes(c.name),
  )
  const got = await Promise.all(
    cards.map(c =>
      rpc($, o, 'agents/get', { name: c.name }).then(
        (g: Got) => ({ c, g, err: '' }),
        (err: Error) => ({ c, g: undefined as Got | undefined, err: err.message }),
      ),
    ),
  )
  const now = new Set<string>()
  const problems: string[] = []
  for (const { c, g, err } of got) {
    if (!g) {
      problems.push(`${c.name}: ${err}`)
      continue
    }
    try {
      const { agent } = await $.agent.register(toSpec(c, g, o))
      now.add(agent)
    } catch (e) {
      problems.push(`${c.name}: ${(e as Error).message}`)
    }
  }
  loaded = now
  const scope = scopeUrl(o).slice(o.url.length) || 'everything'
  const names = [...now].join(', ') || 'none'
  return [`${now.size} agents from kb (${scope}): ${names}`, ...problems].join('\n')
}

type SignIn = { headers?: Record<string, string>; expiresIn?: number }

// A runner's token, read the way bin/mcp-headers reads it. Without a client, its secret or an
// endpoint there is none, and the servers' own sign-in applies.
async function signIn($: any): Promise<SignIn> {
  const client = await $.env.get('KUBED_MCP_CLIENT')
  const endpoint = await $.env.get('MCP_OIDC_ENDPOINT')
  if (!client || !endpoint) return {}
  let secret: string
  try {
    secret = await $.fs.read(secretPath(client))
  } catch {
    return {}
  }
  const res = await $.http.fetch(endpoint, tokenRequest(client, secret))
  if (!res.ok) throw new Error(`${endpoint} refused ${client}: ${res.status}`)
  const { access_token, expires_in } = JSON.parse(res.text)
  return { headers: { Authorization: `Bearer ${access_token}` }, expiresIn: Number(expires_in) || undefined }
}

// Loads again at 80% of the token's life, so an agent started late still signs in.
function scheduleRefresh($: any, o: Options, expiresIn?: number) {
  refresh?.cancel()
  refresh = undefined
  if (!expiresIn) return
  refresh = $.clock.after(expiresIn * 800, () =>
    loadInTime($, o).then(
      text => $.ui.log(`kb-agents: refreshed: ${text}`, { to: 'debug' }),
      err => $.ui.log(`kb-agents: refresh failed: ${(err as Error).message}`),
    ),
  )
}

async function signInAndLoad($: any, o: Options): Promise<string> {
  const auth = await signIn($)
  headers = auth.headers
  const text = await load($, { ...o, headers: auth.headers })
  scheduleRefresh($, o, auth.expiresIn)
  return auth.headers ? text : `${text} (no runner token)`
}

// Never holds the session's start past timeout_ms: kb being down costs its agents, nothing more.
async function loadInTime($: any, o: Options): Promise<string> {
  if (!o.url) throw new Error('no url: set the url option to kb')
  const late = $.clock.sleep(o.timeoutMs).then(() => {
    throw new Error(`kb didn't answer within ${o.timeoutMs} ms`)
  })
  return Promise.race([signInAndLoad($, o), late])
}

// A session's scratchpad is /tmp/claude-<uid>/<project>/<session id>/scratchpad, which no API
// names, and which may not exist yet: find this session's folder, else its project's (the launch
// folder with / as -). Else a folder of the mod's own.
async function scratchRoot($: any): Promise<string> {
  if (scratch) return scratch
  const sid = await $.session.id()
  const project = launchCwd.replace(/[^A-Za-z0-9]/g, '-')
  const tops = (await $.fs.list('/tmp').catch(() => [])).filter(
    (t: any) => t.kind === 'dir' && t.name.startsWith('claude-'),
  )
  for (const top of tops) {
    for (const entry of await $.fs.list(`/tmp/${top.name}`).catch(() => [])) {
      if (entry.kind === 'dir' && (await $.fs.exists(`/tmp/${top.name}/${entry.name}/${sid}`))) {
        return (scratch = `/tmp/${top.name}/${entry.name}/${sid}/scratchpad/kb-skills`)
      }
    }
  }
  for (const top of tops) {
    if (await $.fs.exists(`/tmp/${top.name}/${project}`)) {
      return (scratch = `/tmp/${top.name}/${project}/${sid}/scratchpad/kb-skills`)
    }
  }
  return (scratch = `/tmp/kb-agents-${sid}/kb-skills`)
}

async function viaServer($: any, server: string, uri: string): Promise<string> {
  const r = await $.tool.call({ tool: 'ReadMcpResourceTool', server, uri })
  if (r.deny || r.isError) throw new Error(`${server}: ${r.deny ?? r.text}`)
  return resourceText(r.text, uri)
}

// The mod's own kb, scoped to the URI's library: skills_url with the runner's token, then the
// in-cluster url. What a kb agent's own kb-skills server reads.
async function viaKb($: any, o: Options, uri: string): Promise<string> {
  const params: [string, string][] = [['library', libraryOf(uri)], ['resources', 'off'], ['prompts', 'off']]
  const problems: string[] = []
  for (const base of new Set([o.skillsUrl, o.url].filter(Boolean))) {
    try {
      const call = readToolCall(bare(uri), ++id)
      const res = await $.http.fetch(withQuery(base, params), { ...call, headers: { ...call.headers, ...headers } })
      return toolText(parse('read_resource', res.text), uri)
    } catch (err) {
      problems.push((err as Error).message)
    }
  }
  throw new Error(problems.join('; '))
}

// The server learned for it, else those whose listing serves its library, else the mod's kb.
async function fetchSkillFile($: any, o: Options, uri: string): Promise<{ text: string; via: string }> {
  const tried = new Set<string>()
  const learned = lookup(servers, uri)
  if (learned) {
    tried.add(learned)
    try {
      return { text: await viaServer($, learned, uri), via: learned }
    } catch {}
  }
  let listing: unknown = []
  try {
    listing = JSON.parse((await $.tool.call({ tool: 'ListMcpResourcesTool' })).text ?? '[]')
  } catch {}
  for (const server of listingServers(listing, uri)) {
    if (tried.has(server)) continue
    tried.add(server)
    try {
      const text = await viaServer($, server, uri)
      for (const key of learnedKeys(uri)) servers.set(key, server)
      return { text, via: server }
    } catch {}
  }
  return { text: await viaKb($, o, uri), via: 'kb' }
}

export const register: Register = (on, options) => {
  const o = readOptions(options)

  on('session.start', async ($, e, next) => {
    launchCwd = e.cwd
    await $.command.register({
      name: 'kb-agents',
      description: "Loads kb's agents again, and lists them",
    })
    try {
      $.ui.log(`kb-agents: ${await loadInTime($, o)}`, { to: 'debug' })
    } catch (err) {
      $.ui.log(`kb-agents: no agents loaded: ${(err as Error).message}`)
    }
    return next(e)
  })

  on('command.run', { command: 'kb-agents' }, async $ => {
    try {
      return { text: await loadInTime($, o) }
    } catch (err) {
      return { text: `No agents loaded: ${(err as Error).message}` }
    }
  })

  // Learns which server serves a skill from the model's own reads.
  on('tool.call', { tool: 'ReadMcpResourceTool' }, async ($, e, next) => {
    const r: any = await next(e)
    const { server, uri } = e as any
    if (!r.deny && !r.isError && typeof uri === 'string' && isSkillUri(uri)) {
      try {
        for (const key of learnedKeys(uri)) servers.set(key, server)
      } catch {}
    }
    return r
  })

  // `python3 skill://x/y/scripts/z.py` runs a copy in the session's scratchpad, fetched now.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const command = (e as any).command
    const uris = o.skillUris && typeof command === 'string' ? skillUris(command) : []
    if (uris.length === 0) return next(e)
    const root = await scratchRoot($)
    const paths = new Map<string, string>()
    const problems: string[] = []
    for (const uri of uris) {
      try {
        const path = localPath(root, uri)
        const { text, via } = await fetchSkillFile($, o, uri)
        await $.fs.write(path, text)
        paths.set(uri, path)
        $.ui.log(`kb-agents: ${uri} from ${via} at ${path}`, { to: 'debug' })
      } catch (err) {
        problems.push(`kb-agents couldn't fetch ${uri}, so it ran as written: ${(err as Error).message}`)
      }
    }
    // A URI that fetched nothing stays as written: the command still runs, and says why.
    const r: any = await next({ ...e, command: rewriteCommand(command, paths) } as any)
    return problems.length && !r.deny ? { ...r, context: [...(r.context ?? []), ...problems] } : r
  })

  on('agent.offer', async ($, e, next) =>
    e.agent.startsWith('kb-agents:') && !loaded.has(e.agent) ? { isOffered: false } : next(e),
  )
}
