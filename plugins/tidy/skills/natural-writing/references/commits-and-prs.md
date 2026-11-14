# Commit messages and pull requests: before and after

The "before" text is from [kubed-io/selenium-flow](https://github.com/kubed-io/selenium-flow).

## Commit messages

| Part | Holds |
|---|---|
| Subject | What the commit does, in the imperative, under 72 characters, with the repo's prefix if it uses one (`fix:`, `docs:`) |
| Body | The problem, why this is the fix, and anything a reader of the diff would not guess: a trade-off, a behaviour change, what was left out |
| Trailers | `Closes #n`, `Part of #n`, co-author lines. Keep whatever the repo's tooling expects |

Leave out a file-by-file list the diff already shows, the order you did things in, and what the
docstrings or tests now say. Wrap the body at 72 columns.

### A subject that names the bug

A squash merge that takes the issue title as its subject reads as if the commit introduced the bug.

```text
press_key with no selector presses at the body, not the focused element (#136)
```

```text
fix: press_key with no selector presses the focused element (#136)
```

A one-word subject says nothing in `git log`:

```text
docs
```

Another commit in the same repo shows the shape:

```text
docs: spec and plan for secrets in scope (#143)
```

### A body that lists without saying why

```text
feat: the catalogue reads the forms of the secrets allowed on an origin, and stamps its key files to see a rotation

forms_for(origin) gives the forms of every usable secret allowed there,
leashed() those of every usable secret, for the fail-closed read; neither
reads a refused one, and a key that cannot be read adds nothing. revision()
hashes each usable key file's inode, mtime and size, computed with the
snapshot, so a rotation through Kubernetes' ..data swap is seen within
CACHE_SECONDS. A directory secret and a secrets.entries file key stamp in
one shape. The docstrings name ruling 12's three read paths.

Part of #143 (task 4 of docs/superpowers/plans/2026-11-14-secret-scope.md).
```

```text
feat: read the forms of the secrets allowed on an origin

The scrubber checks every result for the secrets allowed on its page,
typed or not, so it needs their forms and a way to see a rotation.

forms_for(origin) returns the forms of each usable secret allowed on an
origin, and leashed() those of every usable secret, for a page whose
origin is unknown. Neither reads a refused secret, and a key that cannot
be read adds nothing. revision() hashes each usable key file's inode,
mtime and size with the snapshot, so a rotation through the Kubernetes
..data swap shows within CACHE_SECONDS.

Part of #143 (task 4 of docs/superpowers/plans/2026-11-14-secret-scope.md).
```

## Pull requests

| Part | Holds |
|---|---|
| Title | The change, as for a commit subject; it becomes the squash commit's subject |
| First paragraph | What changes for a user or caller, and why. Say "breaking" here if it is |
| Testing | What was run, and what was checked by hand or live |
| Where to look | The one or two places a reviewer should read hardest |
| Links | `Closes #n`, the spec, related pull requests |

Leave out the commit list (the Commits tab has it), the history of review rounds (the timeline has
it), a heading over each one-line section, and emoji. A block that tooling writes and updates, such
as an agent's notes, stays exactly as the tool left it.

### A description that points elsewhere

```markdown
Closes #143

Starts from #143's notes.
```

```markdown
Every result and error is now scrubbed of the secrets allowed on its page, typed or not.
Before, only the call that typed a secret scrubbed it. A match reads `[secret:name/key]`.

Breaking: every secret must declare its allowed sites. One that does not is refused, and its
listing entry says how to fix it.

Tested with the unit suite, `test_scrub_coverage` over every surface, and a live run in Chrome
that found no leaks across 25 browser spellings of a value.

Read `workspace/scrub.py` hardest: it holds the fail-closed paths.

Closes #143
```

## Review replies

This pair is illustrative. Lead with the decision. Keep only the reasoning that would change whether the reviewer agrees, and
put the full diagnosis in the commit that fixes it.

```markdown
Good catch. I looked into this and you're right that there's a race here: between the leash
check and the keystrokes another call could navigate the browser, which would mean the value
gets typed on a page the leash never saw. I've fixed this by holding the browser's lock for the
page read, the check and the typing, so they now happen as one turn. Let me know if you'd like
any other changes!
```

```markdown
Fixed in 1a2b3c4: the page read, the leash check and the keystrokes now run in one turn on the
browser's lock.
```
