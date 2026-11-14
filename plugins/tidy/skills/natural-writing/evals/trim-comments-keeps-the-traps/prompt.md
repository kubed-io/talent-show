---
tags: [natural-writing]
max_turns: 10
timeout_seconds: 600
allowed_tools: [Read, Skill]
---

An agent wrote the comments and docstrings in this excerpt from a Python module. Trim and rewrite them so they read the way a careful engineer would have written them. Change comments and docstrings only: every line of code, every string literal and every `# noqa` stays exactly as it is. Reply with the whole excerpt, rewritten, in one python code block, then one line saying how many comment and docstring lines it had before and after.

```python
def _origin(parts) -> str:
    """Scheme, host and port from an already-split URL: `urls.scope_origin_of`,
    which says why it is built from `hostname` and `port` and never `netloc`."""
    return scope_origin_of(parts)


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
    try:
        parts = urlsplit((line or "").strip())
        origin = _origin(parts)
    except ValueError:
        return "<a line that is not a URL>"
    if not parts.scheme or not origin:
        return "<a line that is not a URL>"
    dropped = []
    if parts.username or parts.password:
        dropped.append("credentials")
    if parts.path.strip("/") or parts.query or parts.fragment:
        dropped.append("a path")
    return origin + (f" (+ {' and '.join(dropped)})" if dropped else "")


def declared_origin(line: str) -> str | None:
    """One line of ``_allowed_urls`` as an origin, or None if it is not one.

    A path is **refused**, not trimmed. §F1.27 compares origins, so
    ``https://host/admin`` and ``https://host/`` are the same permission —
    quietly widening the first into the second makes the file say less than its
    author wrote, and open question #12 settled that a rule which quietly means
    less than it says is worse than no rule.
    """
    text = (line or "").strip()
    if not text:
        return None
    parts = urlsplit(text)
    if not parts.scheme or not parts.netloc:
        return None
    # No `params` here: that is urlparse's ParseResult, not urlsplit's
    # SplitResult — a `;` segment lands in `path` for this one.
    if parts.path.strip("/") or parts.query or parts.fragment:
        return None
    if parts.username or parts.password:
        # Credentials in a permission line are always a mistake, and accepting
        # them would mean the same site reads as two different origins.
        return None
    return _origin(parts)


class FilesystemSource:
    """One directory of secrets, in the shape Kubernetes mounts them."""

    kind = "filesystem"

    def __init__(self, root: str | Path):
        self.root = Path(root)

    def _dir(self, name: str) -> Path:
        """One secret's directory, refusing anything that leaves the root.

        Same rule the flow store settled on: the resolved path must *be* the
        path we asked for, so nothing below the root may traverse a link. The
        root itself is resolved first and so may be one — pointing SECRETS_DIRS
        at a mount is the whole point.
        """
        root = self.root.resolve()
        expected = root / valid_name(name, "secret name")
        path = expected.resolve()
        if path != expected:
            raise InvalidName(
                f"{name!r} does not resolve to itself inside {self.root}"
            )
        return path

    def names(self) -> list[str]:
        try:
            if not self.root.is_dir():
                return []
            entries = list(self.root.iterdir())
        except OSError as exc:
            # "Unreadable is absent" is a promise this module makes and did not
            # keep: a PermissionError here propagated through Catalogue._entries
            # and took down the whole catalogue rather than skipping one
            # directory.
            log.warning("could not list %s: %s", self.root, exc)
            return []
        found = []
        for path in entries:
            # A k8s projected volume is full of these: `..data` is a symlink to
            # a timestamped directory, and every key is a symlink through it.
            # The secrets themselves never start with a dot.
            if path.name.startswith("."):
                continue
            if not path.is_dir():
                continue
            try:
                self._dir(path.name)
            except InvalidName:
                log.warning("ignoring %s: not a usable secret name", path.name)
                continue
            found.append(path.name)
        return sorted(found)

    def _files(self, name: str) -> dict[str, Path]:
        """Every readable file in one secret, keyed by filename.

        One level deep, always: a Kubernetes mount is exactly one level, and
        recursing would invent a shape nothing else produces.
        """
        try:
            directory = self._dir(name)
        except InvalidName:
            return {}
        try:
            if not directory.is_dir():
                return {}
            return {
                path.name: path
                for path in sorted(directory.iterdir())
                if path.is_file() and not path.name.startswith(".")
            }
        except OSError as exc:
            log.warning("could not read %s: %s", directory, exc)
            return {}

    def _read(self, path: Path) -> str | None:
        try:
            return path.read_text(encoding="utf-8").strip()
        except (OSError, UnicodeDecodeError) as exc:
            # Never `exc` itself: a `UnicodeDecodeError`'s message quotes the
            # offending byte, which is a byte of the secret's value.
            log.warning("could not read %s: %s", path.name, type(exc).__name__)
            return None
```
