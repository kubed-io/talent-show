import { expect, test } from 'claude-code/testing'
import { BASH_HINT } from './skillfiles.ts'
import { agentName, many, parse, readOptions, request, scopeUrl, secretPath, tokenRequest, toSpec } from './kb.ts'

const o = readOptions({ url: 'http://kb/mcp', library: '', categories: [], tags: [], agents: [], skills: true, skills_url: 'https://gw/kb/mcp', timeout_ms: 5000 })

test('a multiple option set through --values-stdin arrives as JSON text', async () => {
  expect(many('["a","b"]')).toEqual(['a', 'b'])
  expect(many(['a', ' ', 'b'])).toEqual(['a', 'b'])
  expect(many('oncall,runbooks')).toEqual(['oncall,runbooks'])
  expect(many('')).toEqual([])
})

test('the scope rides the URL, a repeated tag meaning any of them', async () => {
  const scoped = { ...o, library: 'grafana', categories: ['ops'], tags: ['oncall,runbooks', 'lgtm'] }
  expect(scopeUrl(scoped)).toBe('http://kb/mcp?library=grafana&category=ops&tag=oncall%2Crunbooks&tag=lgtm')
  expect(scopeUrl(o)).toBe('http://kb/mcp')
})

test('a request names its method in the header kb checks, and declares the extension', async () => {
  const r = request('agents/get', { name: 'drawio_diagrammer' }, 7)
  expect(r.headers['Mcp-Method']).toBe('agents/get')
  const body = JSON.parse(r.body)
  expect(body.params.name).toBe('drawio_diagrammer')
  expect(Object.keys(body.params._meta['io.modelcontextprotocol/clientCapabilities'].extensions)).toEqual([
    'io.modelcontextprotocol/agents',
  ])
})

test('an answer may come as JSON or as an SSE stream, and an error says why', async () => {
  expect(parse('m', '{"jsonrpc":"2.0","id":1,"result":{"agents":[]}}')).toEqual({ agents: [] })
  expect(parse('m', 'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"x":1}}\n\n')).toEqual({ x: 1 })
  expect(() => parse('agents/list', '{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"Method not found"}}')).toThrow(
    "this kb doesn't serve agents yet",
  )
})

test('the token request is the form mcp-headers sends', async () => {
  const r = tokenRequest('example-client', 's3cr=t\n')
  expect(r.body).toBe('grant_type=client_credentials&client_id=example-client&client_secret=s3cr%3Dt&scope=mcp')
  expect(secretPath('example-client')).toBe('/var/run/secrets/keycloak/example-client/client_secret')
})

test("kb's renamed clash becomes a name an agent type can carry", async () => {
  expect(agentName('drawio_diagrammer@penpot')).toBe('drawio_diagrammer-penpot')
})

test('a kb agent keeps its prompt, model and tools, and loses what would run things', async () => {
  const spec = toSpec(
    { name: 'grafana_panels', description: 'Builds panels.' },
    {
      agent: 'grafana_panels',
      instructions: 'You build panels.',
      _meta: {
        'io.kubed.mcp-kb/agent': {
          library: 'grafana',
          frontmatter: { tools: 'Read, Grep', model: 'sonnet', mcpServers: { x: {} }, hooks: {}, permissionMode: 'bypassPermissions' },
        },
      },
    },
    { ...o, headers: { Authorization: 'Bearer t' } },
  )
  expect(spec.tools).toEqual(['Read', 'Grep'])
  expect(spec.model).toBe('sonnet')
  expect(spec.hooks).toBe(undefined)
  expect(spec.permissionMode).toBe(undefined)
  expect(spec.prompt).toContain('skill://grafana/<skill>/SKILL.md')
  expect(spec.mcpServers).toEqual([
    {
      'kb-skills': {
        type: 'http',
        url: 'https://gw/kb/mcp?library=grafana&resources=off&prompts=off',
        headers: { Authorization: 'Bearer t' },
      },
    },
  ])
})

test('the frontmatter comes from the shared io.kubed/agent, the library from kb\'s own key', async () => {
  const spec = toSpec(
    { name: 'grafana_panels', description: 'Builds panels.' },
    {
      agent: 'grafana_panels',
      instructions: 'You build panels.',
      _meta: {
        'io.kubed/agent': { frontmatter: { tools: ['Read'], model: 'opus', maxTurns: 40 }, skills: {} },
        'io.kubed.mcp-kb/agent': { library: 'grafana', plugin: 'grafana', path: 'agents/panels.md', servers: [] },
      },
    },
    o,
  )
  expect(spec.tools).toEqual(['Read'])
  expect(spec.model).toBe('opus')
  expect(spec.maxTurns).toBe(40)
  expect(spec.prompt).toContain('skill://grafana/<skill>/SKILL.md')
})

test('the routing hint picks a model when the frontmatter names none, and skills can be off', async () => {
  const spec = toSpec(
    { name: 'a_b' },
    { agent: 'a_b', instructions: 'Hi.', modelRoutingHint: { role: 'small', vision: false } },
    { ...o, skills: false, skillUris: false },
  )
  expect(spec.model).toBe('haiku')
  expect(spec.mcpServers).toBe(undefined)
  expect(spec.prompt).toBe('Hi.')
})

test('every kb agent is told about skill:// in Bash, unless skill_uris is off', async () => {
  const got = { agent: 'a_b', instructions: 'Hi.' }
  expect(toSpec({ name: 'a_b' }, got, { ...o, skills: false }).prompt).toBe(`Hi.\n\n${BASH_HINT}`)
  expect(toSpec({ name: 'a_b' }, got, readOptions({ url: 'http://kb/mcp', skills: false, skill_uris: 'false' })).prompt).toBe('Hi.')
})
