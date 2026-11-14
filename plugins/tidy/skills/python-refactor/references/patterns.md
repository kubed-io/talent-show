# Patterns: what to abstract, what to leave

The test for any extraction: after it, is there less code to read for the same behaviour, and does
each caller say less? If a helper needs a flag or a callback per caller to stay shared, it is two
helpers pretending to be one. Leave the copies.

## Worth making

### A table instead of a chain of branches

Before:

```python
def status_for(exc):
    if isinstance(exc, NotFound):
        return 404
    elif isinstance(exc, Forbidden):
        return 403
    elif isinstance(exc, Conflict):
        return 409
    elif isinstance(exc, BadArgument):
        return 400
    return 500
```

After:

```python
STATUS = {NotFound: 404, Forbidden: 403, Conflict: 409, BadArgument: 400}

def status_for(exc):
    return next((code for kind, code in STATUS.items() if isinstance(exc, kind)), 500)
```

The order of the dict is the order of the old `elif`s, which matters if one class subclasses
another. Keep it.

### One helper for a shape written several times

Before, in four tool handlers:

```python
try:
    result = await session.click(selector)
except BrowserGone as e:
    return {"ok": False, "error": f"the browser was closed: {e}"}
except TimeoutError:
    return {"ok": False, "error": f"no element matched {selector} in time"}
return {"ok": True, **result}
```

After:

```python
async def answer(call, selector):
    try:
        result = await call
    except BrowserGone as e:
        return {"ok": False, "error": f"the browser was closed: {e}"}
    except TimeoutError:
        return {"ok": False, "error": f"no element matched {selector} in time"}
    return {"ok": True, **result}

return await answer(session.click(selector), selector)
```

Only when the four copies are identical in what they catch and the text they return. If one says
"the browser has gone" and three say "was closed", that is a behaviour difference: keep that one
separate and note it.

### The same argument list passed through layers

Before: twelve keyword arguments named in the tool function, again in the action it calls, again
in the session constructor.

After: one frozen dataclass built where the arguments arrive, passed down whole.

```python
@dataclass(frozen=True)
class Launch:
    width: int = 1280
    height: int = 800
    headless: bool = True
    ...
```

Not when the outermost signature is a tool or API contract: a framework that builds the tool
schema from the function's parameters needs them spelled out there. Collapse the inner layers
only.

### Delete a wrapper that only forwards

Before:

```python
def get_workspace(name):
    return registry.get(name)
```

After: callers use `registry.get(name)`. Check it isn't patched in tests (`monkeypatch.setattr(...,
"get_workspace", ...)`) or imported by name elsewhere; if it is, that is a test change too.

### A deep module

Several call sites each check a header, parse it, apply a default and log a refusal. One function
`workspace_from(request) -> str` that does all four hides real work behind one name. That is worth
a new function; a `HeaderParser` class with a strategy per header is not.

## Not worth making

### Two similar blocks

Wait for the third. Two copies that drift apart later are cheaper than an abstraction that has to
be undone.

### A helper with a flag per caller

```python
def render(item, *, compact=False, with_links=True, legacy_dates=False):
```

Three callers, three flag sets, one body of `if`s: it was three functions. Leave the copies, or
split it back.

### A base class for two classes

`class BaseStore(ABC)` with two subclasses that share one method. Use a module-level function both
call.

### An option nobody sets

A parameter every caller passes the same value to, or none passes: inline the value. That is a
removal, not a new option, and it is allowed when no public signature changes.

### A new layer

A `services/` package, a repository class over a dict, a registry for things imported directly, a
factory with one product. Each adds a file to read and nothing to do. The goal is less code.

### Splitting a long function that reads top to bottom

High complexity from one flat validation list or a `match` with many cases is not a problem.
Splitting it into five private functions called once each moves the reading around without making
it shorter.
