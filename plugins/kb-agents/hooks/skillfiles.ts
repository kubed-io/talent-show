// A skill's files in a Bash command: `python3 skill://drawio/drawio/scripts/check.py` runs a
// local copy. Pure: the hooks in register.ts fetch and write.

// Told to every kb agent, at the end of its prompt.
export const BASH_HINT =
  "Bash accepts a skill file's skill:// URI (kb+skill:// too) in place of its path: " +
  '`python3 skill://<library>/<skill>/scripts/<file>` runs a local copy of that file.'

// A `skill://` URI, or one a gateway prefixed (`kb+skill://`), up to the next shell delimiter.
// Braces, `$`, `*` and `?` end it: a template or a glob is not a file.
const SKILL_URI = /(?<![A-Za-z0-9+.-])(?:[a-z][a-z0-9.-]*\+)?skill:\/\/[^\s'"`;|&()<>{}$*?]+/g

export function isSkillUri(text: string): boolean {
  return (text.match(SKILL_URI) ?? [])[0] === text
}

// The command with its quoted strings and heredoc bodies blanked, same length: what a shell
// runs, as opposed to text it only passes along (`echo "…"`, `gh … --body "…"`, `cat <<EOF`).
export function shellCode(command: string): string {
  let out = ''
  let i = 0
  const pending: string[] = []
  const blank = (end: number) => {
    out += command.slice(i, end).replace(/[^\n]/g, ' ')
    i = end
  }
  while (i < command.length) {
    const c = command[i]
    if (c === "'") {
      const j = command.indexOf("'", i + 1)
      blank(j < 0 ? command.length : j + 1)
    } else if (c === '"') {
      let j = i + 1
      while (j < command.length && command[j] !== '"') j += command[j] === '\\' ? 2 : 1
      blank(Math.min(command.length, j + 1))
    } else if (c === '\\') {
      blank(Math.min(command.length, i + 2))
    } else if (c === '<' && command.startsWith('<<', i) && command[i + 2] !== '<') {
      const m = /^<<-?[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(command.slice(i))
      if (m) {
        pending.push(m[2])
        blank(i + m[0].length)
      } else {
        out += c
        i++
      }
    } else if (c === '\n' && pending.length) {
      out += c
      i++
      for (const tag of pending) {
        while (i < command.length) {
          const nl = command.indexOf('\n', i)
          const end = nl < 0 ? command.length : nl
          const line = command.slice(i, end)
          blank(end)
          if (i < command.length) {
            out += '\n'
            i++
          }
          if (line.replace(/^\t+/, '') === tag) break
        }
      }
      pending.length = 0
    } else {
      out += c
      i++
    }
  }
  return out
}

// The skill URIs a command runs with, and where each stands in it.
export function skillUriSpans(command: string): { uri: string; start: number; end: number }[] {
  const code = shellCode(command)
  return [...code.matchAll(SKILL_URI)]
    .map(m => ({ uri: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }))
    .filter(s => !/[{}$*?]/.test(code[s.end] ?? ''))
}

export function skillUris(command: string): string[] {
  return [...new Set(skillUriSpans(command).map(s => s.uri))]
}

// The command with each span whose URI has a path swapped for it; quoted text keeps its URIs.
export function rewriteCommand(command: string, paths: ReadonlyMap<string, string>): string {
  let out = command
  for (const s of skillUriSpans(command).reverse()) {
    const path = paths.get(s.uri)
    if (path) out = out.slice(0, s.start) + path + out.slice(s.end)
  }
  return out
}

// Without a gateway's prefix: `kb+skill://drawio/x` is kb's `skill://drawio/x`.
export function bare(uri: string): string {
  return uri.replace(/^[a-z][a-z0-9.-]*\+(?=skill:\/\/)/, '')
}

// The path below `skill://`, refused when a segment could leave the root.
function segments(uri: string): string[] {
  const parts = bare(uri).slice('skill://'.length).split('/')
  if (parts.length < 2 || parts.some(p => p === '' || p === '.' || p === '..')) {
    throw new Error(`${uri} isn't a file of a skill`)
  }
  return parts
}

export function localPath(root: string, uri: string): string {
  return `${root}/${segments(uri).join('/')}`
}

// The library a kb address names first: `skill://drawio/drawio/x` is in `drawio`.
export function libraryOf(uri: string): string {
  return segments(uri)[0]
}

// What a read teaches: the folder the file is in, and the library above it, each keyed with
// the URI's own prefix, since a prefix names one connection's spelling.
export function learnedKeys(uri: string): string[] {
  const parts = segments(uri)
  const scheme = uri.slice(0, uri.indexOf('://') + 3)
  return [`${scheme}${parts.slice(0, -1).join('/')}`, `${scheme}${parts[0]}`]
}

// The server learned for the longest key the URI sits under.
export function lookup(servers: ReadonlyMap<string, string>, uri: string): string | undefined {
  let best: string | undefined
  for (const key of servers.keys()) {
    if (uri.startsWith(`${key}/`) && (!best || key.length > best.length)) best = key
  }
  return best === undefined ? undefined : servers.get(best)
}

// Servers whose listing holds a URI of the same library, in the same spelling.
export function listingServers(listing: unknown, uri: string): string[] {
  const library = learnedKeys(uri)[1]
  const rows = Array.isArray(listing) ? listing : []
  const found = rows
    .filter((r: any) => typeof r?.uri === 'string' && typeof r?.server === 'string')
    .filter((r: any) => r.uri.startsWith(`${library}/`))
    .map((r: any) => r.server as string)
  return [...new Set(found)]
}

// The text a ReadMcpResourceTool call answered with, or why there is none.
export function resourceText(text: string | undefined, uri: string): string {
  let contents: any[] = []
  try {
    contents = JSON.parse(text ?? '').contents ?? []
  } catch {
    throw new Error(`${uri}: the read answered something that isn't a resource`)
  }
  const c = contents[0]
  if (typeof c?.text === 'string') return c.text
  if (c?.blob !== undefined) throw new Error(`${uri} is a binary file, which a mod can't write`)
  throw new Error(`${uri}: the read returned no content`)
}

// kb's read_resource tool, for the mod's own kb.
export function readToolCall(uri: string, id: number) {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2026-07-28',
      'Mcp-Method': 'tools/call',
      'Mcp-Name': 'read_resource',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: 'read_resource',
        arguments: { uri },
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    }),
  }
}

export function toolText(result: any, uri: string): string {
  const text = result?.content?.[0]?.text
  if (result?.isError || typeof text !== 'string') throw new Error(`${uri}: ${text ?? 'no content'}`)
  return text
}
