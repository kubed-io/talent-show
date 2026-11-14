---
name: python-refactor
description: Use when cleaning up existing Python code without changing what it does - removing dead code or unused dependencies, applying ruff autofixes, de-duplicating a module, trimming comments, or shrinking a test suite by merging, parametrising or deleting tests. Also use when an issue asks for a behaviour-preserving refactor of one module or subsystem, before acting on vulture, pylint or radon output, and before deleting or merging any test.
---

# Python refactor

Less code, same behaviour. One module or subsystem per run, one kind of change per commit, and
the unit suite green after every commit. A cleanup that changes behaviour, however small or
however much better, is not done here: it is stopped and written down.

## The loop

1. Baseline. Write every tool's output to a file under `.refactor/` (add it to
   `.git/info/exclude`) and read its summary, not the raw output; `references/tools.md` has both.
   Record: source and test lines, test count, coverage percent, and any test that fails or flips.
2. Pick one kind of change from the table below and make it across the run's scope.
3. Run the unit suite. Coverage must not drop below the baseline. Red: fix the change or revert it,
   never the test.
4. Commit that kind alone, with what was proven in the message. Go to 2.
5. Report (last section).

| Kind of change, one per commit | Proof before committing |
| --- | --- |
| One ruff rule family's safe fixes | `ruff check --select <FAM> --fix`, then the suite |
| Dead code from vulture | each name grepped as in Tool findings, then the suite |
| An unused dependency (deptry DEP002) | grepped for plugin, entry-point and string use; the package builds |
| Comments and docstrings | `python3 scripts/ast_same.py HEAD` exits 0 and lists no tool's docstring |
| One de-duplication or abstraction | suite passes with tests unchanged except imports |
| Test changes (fixtures, parametrise, delete) | coverage holds; each deleted test names its keeper |

A test change and a code change never share a commit: the unchanged suite is what proves the
code change.

## What counts as behaviour

Anything a caller, a client, a model, an operator or a test can observe stays byte-for-byte.

| Surface | Examples |
| --- | --- |
| Tool and API contract | tool names, argument names, defaults and order, result shape, field names |
| Error text | exception messages, error results, HTTP status and body. Wording counts. |
| Tool docstrings | many MCP frameworks send a tool's docstring as the description a model reads |
| HTTP surface | routes, methods, headers read or sent, content types, redirects |
| Configuration | env var and config key names, defaults, precedence, what an unset value means |
| Logs | lines tests assert on, lines dashboards or people search for, log levels |
| Timing and order | concurrency, retry counts, timeouts, the order side effects happen in |
| Files and storage | paths written, file formats, database schemas |

Stop and write a note (file, line, what would change, why it is tempting) when a change would:
alter any row above; touch a test's assertions to make it pass; need a new option or parameter
to keep two call sites alike; or fix a bug you found. Bugs go in the report, not in the diff.

## Tool findings are leads

| Tool | Gives | Before acting |
| --- | --- | --- |
| ruff `UP SIM C4 RET PIE FURB PERF` | safe rewrites | families already in the project's `select` yield nothing; skip them. Never `--unsafe-fixes` in bulk |
| ruff `ERA` | commented-out code | no autofix; read each, some are examples or disabled config |
| vulture | names nothing calls | grep the name: decorators, `getattr`/string use, framework hooks (`on_*`, `model_config`), entry points, templates, JS/UI, docs. Most hits are registrations |
| deptry | unused or missing deps | run in the project's environment; plugins, CLI-only and string-loaded packages show as unused |
| pylint duplicate-code / symilar | copied blocks | compares across files only; a shared keyword list is often two call sites of one signature, not a copy |
| radon cc | complexity per function | C and worse is where to read first, not an order to split |

## What to abstract, what to leave

| Make | Leave |
| --- | --- |
| A helper when the same shape is written three times | Two similar blocks: wait for the third |
| A table (dict, tuple of rows) in place of a chain of `if`/`elif` on one value | Branches that each do different work |
| A deep function with a small interface that hides real work | A thin wrapper or pass-through: delete it, call the target |
| One argument-check, error-wrapping or response-shaping helper used everywhere | A helper that needs a flag per caller to stay shared |
| Moving code next to its only user | New layers, base classes, registries, options or plugins |

## Tests

| Rule | Meaning |
| --- | --- |
| Pointless test | asserts nothing that can fail, expects what a mock returns, or re-tests what another test at the same boundary asserts |
| Two tests are one | same setup, same call, same assertion, different constants: parametrise with `ids` |
| Merging asserts is honest | when they describe one outcome of one call (fields of one result) |
| Merging asserts hides a failure | when they are separate behaviours: the first failure masks the rest; parametrise instead |
| Fixtures | setup repeated in three tests becomes a fixture in the nearest `conftest.py` |
| Deleting | the commit names, per deleted test, the test that still holds that behaviour |
| Coverage | never below the baseline, for the package and for each module the run touched |
| Flaky | fixed at its cause (a race, shared state, order, real time). Never a sleep, a retry, a rerun plugin or a looser assert |

Never delete a test that fails, or the only test of a public contract, error text or config key.
Details and examples: `references/tests.md`.

## Report

End the run with:

- lines before and after, source and tests separately (`radon raw` sloc), and test count;
- coverage before and after;
- the commits, one line each, with the kind of change and how it was proven;
- every stop: file, line, the behaviour that would change, and why it looked worth it;
- vulture or duplicate leads left alone, and why.

## References

| Open | When |
| --- | --- |
| `references/tools.md` | before running any tool: exact commands, output shape, how to summarise it |
| `references/tests.md` | before changing a test |
| `references/patterns.md` | before extracting a helper or deleting a wrapper |
| `scripts/ast_same.py` | `python3 scripts/ast_same.py <rev> [paths]`: proves only comments and docstrings changed; `A..B` checks one commit |

## Common mistakes

| Mistake | Instead |
| --- | --- |
| Deleting a handler vulture called unused | it is registered by a decorator; grep before every removal |
| `ruff --unsafe-fixes` across a package | SIM103 turns `if c: return True` / `return False` into `return c`, which may not be a bool |
| Unifying two error messages while de-duplicating | the wording is behaviour: keep both, or stop and note |
| Piping radon into `head` | radon crashes on a closed pipe; write to a file |
| Counting a lower line count as success while coverage fell | coverage is the guard, lines are the result |
