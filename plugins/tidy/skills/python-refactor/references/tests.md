# Tests: what to cut, what to merge, what to fix

A test earns its place by failing when a behaviour breaks and passing when only the implementation
changes. The aim is fewer tests that each say one thing, not fewer assertions.

Before touching a test: run it and see it pass, read the code it covers, and find the other tests
of the same code (`git grep -n 'function_name' tests/`). A test that fails before your change is a
finding for the report, never a deletion.

## Pointless tests

| Sign | Check |
| --- | --- |
| Asserts nothing that can fail | would it pass if the code returned `None`? |
| Expected value comes from the code under test | `assert f(x) == f(x)`, or a constant copied from the module |
| A mock supplies the answer being asserted | the fake returns `"ok"` and the test asserts `"ok"` |
| Asserts how, not what | `mock.assert_called_once_with(...)` on an internal helper |
| Same contract, same boundary, twice | two tests through the same entry point, same assertion |

Keep, whatever they look like: the only test of a public contract (a tool's arguments, result or
error text, an HTTP route, a config key, a stored format), a test that fails when a user-facing
string changes, and a test of a security check.

Before:

```python
def test_status_calls_probe(monkeypatch):
    probe = Mock(return_value={"ok": True})
    monkeypatch.setattr(health, "_probe", probe)
    health.status()
    probe.assert_called_once()
```

After: deleted. The commit says `test_status_reports_a_failed_probe in test_health.py holds what
status() returns`, which is what a caller sees; this one broke under any rewrite of the internals.

## Two tests that are one

Same setup, same call, same kind of assertion, different constants: one parametrised test.

Before:

```python
def test_dialog_rejects_an_unknown_action(client):
    r = client.post("/dialog", json={"action": "wave"})
    assert r.status_code == 400
    assert "unknown action 'wave'" in r.json()["error"]

def test_press_key_rejects_an_unknown_key(client):
    r = client.post("/press_key", json={"key": "Hyper"})
    assert r.status_code == 400
    assert "unknown key 'Hyper'" in r.json()["error"]
```

After:

```python
@pytest.mark.parametrize(("path", "body", "error"), [
    ("/dialog", {"action": "wave"}, "unknown action 'wave'"),
    ("/press_key", {"key": "Hyper"}, "unknown key 'Hyper'"),
], ids=["dialog-unknown-action", "press-key-unknown-key"])
def test_a_bad_argument_is_refused_with_its_name(client, path, body, error):
    r = client.post(path, json=body)
    assert r.status_code == 400
    assert error in r.json()["error"]
```

Each case still fails on its own, under its own id. Error text stays exact; don't loosen it to a
shared substring.

Exact copies (identical bodies under two names) are one test: delete one, and name the keeper.

## Merging asserts

Honest: the assertions describe one result of one call. If one fails, the others don't matter.

```python
def test_open_session_reports_the_browser(client):
    r = client.post("/session", json={"browser": "firefox"}).json()
    assert r["browser"] == "firefox"
    assert r["headless"] is True
```

Hiding a failure: the assertions are separate behaviours chained into one test. The first failure
stops the test, so a second regression stays invisible until the first is fixed, and the name no
longer says what broke.

Before (what not to produce):

```python
def test_workspace_names(client):
    assert client.get("/", headers={"X-Workspace": "a"}).json()["workspace"] == "a"
    assert client.get("/", headers={"X-Workspace": ""}).status_code == 400
    assert client.get("/", headers={"X-Workspace": "shared"}).status_code == 403
```

After: parametrise, or keep them apart. Merging is for one outcome, parametrising is for one shape.

## Fixtures over repeated setup

Setup written out in three or more tests becomes a fixture in the nearest `conftest.py`. A fake
copied into several files becomes one fake in `conftest.py` or a `tests/fakes.py`.

```python
@pytest.fixture
def workspace(tmp_path):
    ws = Workspace(root=tmp_path, name="t")
    yield ws
    ws.close()
```

A fixture with an option per caller is two fixtures. Don't move a test's arrange step into a fixture
when the arrange step is what the test is about.

## Deleting

Every deleted test is listed in the commit message with the test that still holds its behaviour:

```
tests: drop two duplicates

- test_parse_url_with_route: same body as test_parse_url
- test_log_uris_have_views: subset of test_every_uri_has_one_view
```

Check with the per-test coverage query in `tools.md` that no line depended on the deleted test
alone. Package and per-module coverage stay at or above the baseline; a module the run refactored
keeps every test it had.

## Flaky tests

A test that fails in one run and passes in the next has a cause. Find it, fix it there.

| Cause | Sign | Fix |
| --- | --- | --- |
| Shared state | fails only in random order | the test or fixture that leaks it resets it; module globals go behind a fixture |
| A race | fails under `--count=50` alone | wait on the event that means "done" (`asyncio.Event`, a future, a queue), not on time |
| Real time | asserts on elapsed time or a timestamp | inject a clock or monkeypatch `time.monotonic`; assert order, not duration |
| Port, file or name reuse | fails when run alongside itself | `tmp_path`, port 0, unique names |

Never: `asyncio.sleep` or `time.sleep` to let something finish, `pytest-rerunfailures` or a retry
loop, a wider tolerance, or an assert loosened from `==` to `in`. Each makes the test pass while
the race stays in the code.

Before:

```python
async def test_a_free_lock_answers_at_once(locks):
    task = asyncio.create_task(locks.acquire(timeout=5))
    await asyncio.sleep(0.05)
    assert task.done()
```

After:

```python
async def test_a_free_lock_answers_at_once(locks):
    result = await asyncio.wait_for(locks.acquire(timeout=5), 1)
    assert result["holder"] is None
```

The first guessed how long "at once" takes; the second fails only if the answer never comes or is
wrong. If even that flips, the code has the race, and that is a finding, not a test change.

## Benchmarks and profiling tests

A benchmark that no CI job runs with a threshold guards nothing. Either wire it into CI with a
threshold that fails, or delete it and say so in the report.
