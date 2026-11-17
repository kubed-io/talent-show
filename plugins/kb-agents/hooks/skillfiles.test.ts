import { expect, test } from 'claude-code/testing'
import {
  learnedKeys,
  listingServers,
  localPath,
  lookup,
  resourceText,
  rewriteCommand,
  skillUris,
} from './skillfiles.ts'

test('a command names skill files by URI, prefixed or not, up to a shell delimiter', async () => {
  const command = `python3 skill://drawio/drawio/scripts/check.py a.drawio && cat kb+skill://penpot/x/y.md; echo myskill://no`
  expect(skillUris(command)).toEqual(['skill://drawio/drawio/scripts/check.py', 'kb+skill://penpot/x/y.md'])
  expect(skillUris('python3 skill://a/b/main.py  # needs skill://a/b/helper.py')).toEqual([
    'skill://a/b/main.py',
    'skill://a/b/helper.py',
  ])
  expect(skillUris('ls -la')).toEqual([])
})

test('a URI in quoted text or a heredoc is text the command passes along, not a file it runs', async () => {
  expect(skillUris(`gh issue comment 1 --body "read skill://a/b/SKILL.md" && echo 'skill://a/b/x.py'`)).toEqual([])
  const heredoc = `cat > notes.md <<'EOF'\nsee skill://a/b/SKILL.md\nEOF\npython3 skill://a/b/run.py`
  expect(skillUris(heredoc)).toEqual(['skill://a/b/run.py'])
  expect(skillUris('cat <<-EOF\n\tskill://a/b/x.py\n\tEOF')).toEqual([])
})

test('a template or a glob is not a file', async () => {
  expect(skillUris('echo skill://{library}/{+path} skill://a/*.py')).toEqual([])
})

test('only the URIs a command runs with are swapped for their paths', async () => {
  const command = `python3 skill://a/b/run.py --note "skill://a/b/run.py stays"`
  const paths = new Map([['skill://a/b/run.py', '/s/a/b/run.py']])
  expect(rewriteCommand(command, paths)).toBe(`python3 /s/a/b/run.py --note "skill://a/b/run.py stays"`)
  expect(rewriteCommand('python3 skill://x/y/z.py', paths)).toBe('python3 skill://x/y/z.py')
})

test('a URI maps to the same path below the root, and never leaves it', async () => {
  expect(localPath('/s', 'kb+skill://drawio/drawio/scripts/check.py')).toBe('/s/drawio/drawio/scripts/check.py')
  expect(() => localPath('/s', 'skill://drawio/../../etc/passwd')).toThrow("isn't a file of a skill")
  expect(() => localPath('/s', 'skill://drawio')).toThrow("isn't a file of a skill")
})

test("a read teaches its folder and its library, in the URI's own spelling", async () => {
  expect(learnedKeys('kb+skill://drawio/drawio/SKILL.md')).toEqual(['kb+skill://drawio/drawio', 'kb+skill://drawio'])
  const servers = new Map([
    ['skill://drawio', 'kb'],
    ['skill://drawio/drawio', 'drawio'],
  ])
  expect(lookup(servers, 'skill://drawio/drawio/scripts/check.py')).toBe('drawio')
  expect(lookup(servers, 'skill://drawio/other/x.py')).toBe('kb')
  expect(lookup(servers, 'kb+skill://drawio/drawio/x.py')).toBe(undefined)
  expect(lookup(servers, 'skill://drawiox/a/b')).toBe(undefined)
})

test('a listing names the servers that serve a library', async () => {
  const listing = [
    { uri: 'kb+skill://drawio/_index.md', server: 'drawio' },
    { uri: 'skill://superpowers/_index.md', server: 'kb' },
    { uri: 'kb+skill://drawio/_files.md', server: 'drawio' },
  ]
  expect(listingServers(listing, 'kb+skill://drawio/drawio/scripts/check.py')).toEqual(['drawio'])
  expect(listingServers(listing, 'skill://drawio/drawio/scripts/check.py')).toEqual([])
  expect(listingServers('nonsense', 'skill://a/b/c')).toEqual([])
})

test('a resource read gives its text, and a binary file says why it is refused', async () => {
  expect(resourceText('{"contents":[{"uri":"u","text":"print(1)"}]}', 'u')).toBe('print(1)')
  expect(() => resourceText('{"contents":[{"uri":"u","blob":"AA=="}]}', 'u')).toThrow('binary file')
})
