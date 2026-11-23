import { expect, mock, test } from 'claude-code/testing'

const OPTIONS = { options: { url: 'http://kb/mcp', library: 'drawio', timeout_ms: 5000 } }

// kb's answers to agents/list and agents/get, each a JSON-RPC result.
function kb(body: string) {
  const { id, method } = JSON.parse(body)
  const result =
    method === 'agents/list'
      ? { agents: [{ name: 'drawio_diagrammer', description: 'Draws diagrams' }] }
      : { agent: 'drawio_diagrammer', instructions: 'You draw diagrams.' }
  return { status: 200, ok: true, headers: {}, text: JSON.stringify({ jsonrpc: '2.0', id, result }) }
}

// The engine beneath the plugin: no runner sign-in, a log, and a session to start.
function engine(on: any, { kbAfter = 0, registerAfter = 0 } = {}) {
  const clock = mock.clock(on)
  mock.env(on, {})
  const logs: string[] = []
  on('command.register', () => ({ value: { command: 'kb-agents' } }))
  on('ui.log', (_: any, e: any) => {
    logs.push(e.text)
    return { value: undefined }
  })
  on('http.fetch', async (_: any, e: any) => {
    if (kbAfter) await clock.sleep(kbAfter)
    return { value: kb(e.init.body) }
  })
  on('agent.register', async (_: any, e: any) => {
    // Claude Code answers a register once the session binds, seconds into a busy start.
    if (registerAfter) await clock.sleep(registerAfter)
    return { value: { agent: `kb-agents:${e.name}` } }
  })
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  return { clock, logs }
}

test("a register Claude Code answers late isn't blamed on kb, and the start doesn't wait on it", OPTIONS, async ($, on) => {
  const { clock, logs } = engine(on, { registerAfter: 14_000 })

  const started = $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  let isStarted = false
  started.then(() => (isStarted = true))
  await clock.settle()
  expect(isStarted).toBe(true)

  await clock.advance(15_000)
  await started
  expect(logs.some(l => l.includes("didn't answer"))).toBe(false)
  expect(logs).toContain('kb-agents: 1 agents from kb (?library=drawio): kb-agents:drawio_diagrammer (no runner token)')
})

test('a kb that never answers costs its agents after timeout_ms, and says so', OPTIONS, async ($, on) => {
  const { clock, logs } = engine(on, { kbAfter: 60_000 })

  const started = $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(5_000)
  await started
  expect(logs).toContain("kb-agents: no agents loaded: kb didn't answer within 5000 ms")
})

test('/kb-agents waits for the registering and reports it', OPTIONS, async ($, on) => {
  const { clock } = engine(on, { registerAfter: 2_000 })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  // It waits behind the start's own registering, still answering: two registers late.
  const ran = $.command.run({ command: 'kb-agents', args: '' })
  await clock.advance(2_000)
  await clock.advance(2_000)
  expect((await ran).text).toBe('1 agents from kb (?library=drawio): kb-agents:drawio_diagrammer (no runner token)')
})
