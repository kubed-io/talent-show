---
tags: [python-refactor]
max_turns: 15
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

Our `tests/test_routes.py` is too long and I want it leaner without losing anything. Here is what is in it:

```python
def test_dialog_rejects_an_unknown_action(client):
    r = client.post("/dialog", json={"action": "wave"})
    assert r.status_code == 400
    assert "unknown action 'wave'" in r.json()["error"]

def test_press_key_rejects_an_unknown_key(client):
    r = client.post("/press_key", json={"key": "Hyper"})
    assert r.status_code == 400
    assert "unknown key 'Hyper'" in r.json()["error"]

def test_health_is_ok(client):
    assert client.get("/health").json() == {"ok": True}

def test_health_answers(client):
    assert client.get("/health").json() == {"ok": True}

def test_header_names_the_workspace(client):
    assert client.get("/", headers={"X-Workspace": "a"}).json()["workspace"] == "a"

def test_an_empty_header_is_refused(client):
    assert client.get("/", headers={"X-Workspace": ""}).status_code == 400

def test_the_shared_name_cannot_be_claimed(client):
    assert client.get("/", headers={"X-Workspace": "shared"}).status_code == 403

async def test_a_free_lock_answers_at_once(locks):
    task = asyncio.create_task(locks.acquire(timeout=5))
    await asyncio.sleep(0.05)
    assert task.done()
```

The last one fails about one run in thirty in CI. A colleague suggested merging the three header tests into one `test_workspace_header`, and bumping the sleep to 0.5. What would you change? Show the resulting tests and say what goes in each commit. Don't change any files.
