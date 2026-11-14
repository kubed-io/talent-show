# READMEs, AGENTS.md, wiki pages and specs: before and after

The "before" text is from [kubed-io/selenium-flow](https://github.com/kubed-io/selenium-flow).

## What each document is for

| Document | Holds | Sends elsewhere |
|---|---|---|
| README | What it is, how to start, what it does well, with the best scenarios up front | Design rationale, history, roadmaps, "not built yet" tables, status disclaimers |
| AGENTS.md | Rules and invariants an agent must not break, the commands, where to look | The reasoning behind each rule (the spec), anything a linter already enforces |
| Wiki page | How one thing works and how to use it, for someone looking it up | The story of how it came to work that way |
| Spec | Requirements and decisions as they stand now | Who ruled what and when (the issue or pull request), line numbers, transcripts |

A README may sell. Keep its tone and its emoji if the project already has them, and make every
claim true: check it against the code or the tests before you keep it.

## A module docstring that argues for itself

Before (49 lines, trimmed here):

```python
"""The secrets an agent may bind, and the one thing it may never do with them.

A secret here is **a directory of files**: the directory is the secret's name,
each file is a key, and the file's content is the value. That is exactly how
Kubernetes projects a Secret into a pod, and it is also what somebody makes by
hand on a laptop — so one reader serves both and there is no adapter between
them (saga §F1.18).
...
§F1.23's rule that a value is read only at the moment it is bound has three
more read paths (spec 2026-11-14-secret-scope, ruling 12), all through
`forms_for` and `leashed` and all feeding the scrubber: ...

That guarantee is precise and worth stating in its limits, because a security
feature that overstates itself is worse than none: **the value never passes
through the model on its way in.** Once it has been typed into a page,
`execute_script` can read it back off that page, and nothing here can prevent
that (§F1.24).
"""
```

After:

~~~python
"""The secrets an agent may bind, and the rule that no caller sees a value.

A secret is a directory of files: the directory is the secret's name, each file
is a key, and its content is the value. Kubernetes projects a Secret into a pod
in this shape, and it is easy to make by hand.

```
<a directory on SECRETS_DIRS>/
  nextcloud-admin/
    username
    password
    _description        # optional, and not a key
    _allowed_urls       # optional, one origin per line, and not a key
```

``SECRETS_DIRS`` is a list like PATH (``/run/secrets:/etc/selenium-flow/secrets``),
and the first match wins.

``secrets.entries`` in the config file overlays the directories. It can add a
description or a leash, replace one key with a value read from an env var or a
file, or define a whole secret. A key it names wins over a directory's, and an
``allowed_urls`` it names replaces the directory's leash.

A value is read only when `bind` hands it to the action that types it, or when
the scrubber needs its forms (`forms_for`, `leashed`). No surface returns one,
and nothing here caches or logs one. Once a value is typed into a page,
`execute_script` can read it back, and nothing here prevents that.
"""
~~~

The limit in the last sentence stays: it changes what an operator would trust.

## Rationale in AGENTS.md

```markdown
That split is deliberate: the server is useless without a Grid, so it is deployed as a
component *of* the Selenium app rather than as a free-standing app.
```

```markdown
It is deployed as a component of the Selenium app, since it does nothing without a Grid.
```

```markdown
**The vocabulary, because it is easy to get wrong:**
```

```markdown
## Vocabulary
```

## Justifying a plain rule in a README

```markdown
**Sending both is a 400**: two names is two ideas about who is calling.
```

```markdown
Sending both is a 400.
```

A heading that denies a claim nobody made:

```markdown
### 🧠 A workspace is not a browser
```

```markdown
### 🧠 Workspaces outlive browsers
```

A contrast earns its place when the reader would otherwise believe the first half. This one stays:

```markdown
> 🔑 A workspace name is an address, not a secret: the bearer token is the credential, so anyone
> holding it who knows your workspace's name can drive your browser.
```

## Provenance at the top of a spec

```markdown
**Status: SETTLED 2026-11-14, issue #143, pull request #144. Rulings 1-12 are
Dr K's, from #143 (11-13 22:09 to 11-14 00:49). Dr K approved the spec on
11-14 (`spec approved`). Rulings 13-24 are the agent's, written on #144
against the code (2026-11-14); 15, 19 and 22 change something #143's notes
proposed and are named in the reply for Dr K. ...**
```

```markdown
Status: settled 2026-11-14. Built by [the plan](../plans/2026-11-14-secret-scope.md); the rulings
are discussed on #143 and #144.
```

## Line numbers in a living document

```markdown
`secrets.perform_write` (734-800) scrubs its own result and error with `hidden` (776).
```

```markdown
`secrets.perform_write` scrubs its own result and error with `hidden`.
```

Symbol names survive the next commit; line numbers do not.
