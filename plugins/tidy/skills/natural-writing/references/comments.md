# Comments and docstrings: before and after

Every "before" is from [kubed-io/selenium-flow](https://github.com/kubed-io/selenium-flow)
(`kubed/selenium_flow/secrets.py` and `flows/engine.py`), as an agent wrote it. Each pair names the
habit, then shows the fix.

## The story of the fix

The comment tells how the bug was found. The reader needs the rule that stops it coming back.

```python
def _shown(line: str) -> str:
    """A rejected permission line, safe to publish.

    An operator needs to see *which* line is wrong. They do not need anything it
    carries, and `/secrets` is a place a credential must never appear — so this
    **rebuilds** the line from its harmless parts rather than echoing it with
    the bad part taken out.

    That distinction is the whole fix. Removing userinfo still published the
    path and query, and `https://host/login?token=hunter2` is exactly the shape
    a credential arrives in — so the branch that refuses a line for carrying one
    was handing it back. What went missing is *named*, never quoted: the reason
    a line was refused is enough to correct it.
    """
```

```python
def _shown(line: str) -> str:
    """A rejected `_allowed_urls` line, safe to publish in `/secrets`.

    Rebuilt from its origin, with whatever was dropped named and never quoted:
    a line is often refused for carrying a credential in its userinfo or query.
    """
```

## A promise that was broken once

```python
        except OSError as exc:
            # "Unreadable is absent" is a promise this module makes and did not
            # keep: a PermissionError here propagated through Catalogue._entries
            # and took down the whole catalogue rather than skipping one
            # directory.
```

```python
        except OSError as exc:
            # Unreadable means absent; raising here would fail the whole catalogue.
```

## Citations a reader cannot follow

Ticket numbers, review bots, plan tasks and ruling numbers rot, and `git blame` already leads to
the commit that carries them.

```python
    The page read, the leash check and the keystrokes are ONE turn on the
    browser (`workspace.locks`): another call navigating or switching frames
    between the check and the typing would type the value somewhere the leash
    never saw (Copilot, #52).
```

```python
    The page read, the leash check and the keystrokes are one turn on the
    browser (`workspace.locks`), so no other call can navigate or switch frames
    between the check and the typing.
```

## The same rule at every site

`engine.py` explained five times that saving validates a flow but a file edited on disk skips
saving. Say it once, in the module docstring, and delete the five copies.

```python
            # Saving refuses a bad one; a document edited on disk never went
            # through saving, and is refused here on the same terms.
```

```python
"""...
The store also reads flows edited on disk, which never went through saving, so
every check saving makes is made again here.
"""
```

## Arguing with an earlier design

The reader has only the current code. The old design and why it lost belong in the commit that
removed it.

```python
        # No top-level `result`. It used to carry the last step's, which meant
        # a flow ending in `extract` with `return: true` — the shape every
        # example taught — reported the same object twice, once under its step
        # and once here. Worse, it was a second way to say what a run answers
        # with: `return` is the explicit one, and two mechanisms for one job is
        # how they drift.
        #
        # A step now says whether its result is part of the flow's answer, ...
```

```python
        # No top-level `result`: the steps marked `return` carry the answer.
```

## Emphasis in place of a reason

```python
    # It OVERWRITES rather than filling a gap, and that is the point. The
    # argument is not part of the saved-flow schema - `step_schemas` is
    # built from the MCP tool, which deliberately omits it - so a document
    # carrying one was hand-edited on disk and never passed validation. A
    # step that could name a library would be a step that reads another
    # workspace's kept files, which is not a feature (Copilot, #32).
```

```python
    # Set over any value the step carries: the argument is not in the
    # saved-flow schema, and a step that could name a library could read
    # another workspace's kept files.
```

## A closing aphorism

```python
        **One snapshot, because the two are one fact.** The entry carries the
        policy ... and the new secret's value was returned.

        A bind is a policy and a value about the same secret, or it is nothing.
```

```python
        The entries and the owners come from one read, so a bind checks the
        leash of the same secret whose value it returns.
```

## A comment that drifted from its line

A block above `OFF` explained `BINDABLE`, three lines further down. Put it back on the line it
describes.

```python
# Which actions may have a secret bound into them, and nothing else (§F1.28).
#
# Not `execute_script`: a script is arbitrary code, and a bindable argument
# there is an exfiltration API with extra steps. Not `navigate`: ...
# Said by both surfaces that can meet a server with no catalogue ...
OFF = (
    ...
)

BINDABLE = {"write"}
```

```python
OFF = (
    ...
)

# Only `write` types a value into a field. `execute_script` could read it
# back, and `navigate` would put it in history, the referrer and the
# workspace record.
BINDABLE = {"write"}
NOT_YET = {"upload_file"}  # a credentials file is a plausible later case
```

## A docstring for a one-line wrapper

```python
def _origin(parts) -> str:
    """Scheme, host and port from an already-split URL: `urls.scope_origin_of`,
    which says why it is built from `hostname` and `port` and never `netloc`."""
    return scope_origin_of(parts)
```

```python
def _origin(parts) -> str:
    """`origin` for a URL already split by `urlsplit`."""
    return scope_origin_of(parts)
```

## Keep these

These pass the test: each names a trap a careful reader would still walk into.

```python
        except (OSError, UnicodeDecodeError) as exc:
            # Never `exc` itself: a `UnicodeDecodeError`'s message quotes the
            # offending byte, which is a byte of the secret's value.
```

```python
            # A k8s projected volume is full of these: `..data` is a symlink to
            # a timestamped directory, and every key is a symlink through it.
```

```python
    # No `params` here: that is urlparse's ParseResult, not urlsplit's
    # SplitResult. A `;` segment lands in `path` for this one.
```

```python
# The runner's old logger name: operators filter logs by it.
log = logging.getLogger("kubed.selenium_flow.flows.run")
```
