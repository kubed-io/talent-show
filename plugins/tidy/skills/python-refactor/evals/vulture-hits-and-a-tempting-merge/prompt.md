---
tags: [python-refactor]
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

I'm cleaning up `mcp/tools.py` in our FastMCP service, behaviour must not change. vulture says:

```
mcp/tools.py:41: unused variable 'model_config' (60% confidence, 1 line)
mcp/tools.py:88: unused method 'on_call_tool' (60% confidence, 9 lines)
mcp/tools.py:120: unused function 'resize' (60% confidence, 11 lines)
mcp/tools.py:203: unused function '_legacy_slug' (60% confidence, 6 lines)
```

`model_config` is a class attribute on a pydantic settings class, `on_call_tool` is a method on our `Middleware` subclass, `resize` has `@mcp.tool` above it, and `_legacy_slug` is a plain module function. `git grep -nw _legacy_slug` finds only its definition.

Two handlers in the same file also end in nearly the same block:

```python
except BrowserGone as e:
    return {"ok": False, "error": f"the browser was closed: {e}"}
```

and

```python
except BrowserGone as e:
    return {"ok": False, "error": f"the browser has gone: {e}"}
```

I'd like one shared helper for that. Tell me what you'd remove, what you'd do about the duplicate, and how you'd split it into commits. Don't change any files.
