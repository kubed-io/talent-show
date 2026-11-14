# Tools: commands, output, how to read it

Checked against ruff 0.17.5, vulture 2.16, radon 6.0.1, pylint 4.1.3, deptry 0.25.1, mutmut 3.8.1,
pytest-randomly 5.1.0, pytest-repeat 0.9.4 and coverage 7.17. Re-check a flag with `--help` when
the installed version differs.

Every command writes to `.refactor/`; read the summary line, not the file. Set it up once:

```sh
mkdir -p .refactor && echo .refactor/ >> .git/info/exclude
PKG=src/mypkg      # the package directory; tests in tests/
```

## Baseline

```sh
radon raw -j $PKG > .refactor/raw-src.json
radon raw -j tests > .refactor/raw-tests.json
jq '[.[].sloc] | add' .refactor/raw-src.json .refactor/raw-tests.json   # source lines, test lines
radon cc -j -n C $PKG > .refactor/cc.json
vulture $PKG tests --min-confidence 60 > .refactor/vulture.txt
symilar -d 6 -i --ignore-docstrings --ignore-imports --ignore-signatures \
  $(git ls-files "$PKG/*.py") > .refactor/dups.txt
pytest -q -p no:randomly --cov=$PKG --cov-branch --cov-report=json:.refactor/cov.json \
  > .refactor/run1.txt 2>&1
tail -1 .refactor/run1.txt                       # "4579 passed, 31 skipped ... in 190.88s"
jq .totals.percent_covered .refactor/cov.json
pytest -q -p no:randomly > .refactor/run2.txt 2>&1
pytest -p randomly > .refactor/run3.txt 2>&1     # random order; the header has the seed
grep -h -E '^(FAILED|ERROR) ' .refactor/run?.txt | sed 's/ - .*//' | sort | uniq -c  # under 3: flipped
bandit -r $PKG -q -f json -o .refactor/bandit.json; jq '.results | length' .refactor/bandit.json
```

A test that failed in some runs and passed in others goes on the baseline's flaky list, with the
seed. Bandit is a count to hold, not a list to fix in this round: a security fix changes behaviour.

`sloc` is source lines without blanks, comments or docstrings. Use it for "lines before and after".
Radon raises `BrokenPipeError` when piped into `head`; that is one reason everything goes to a
file. `radon mi` is a size proxy: in a 24k-line service 114 of 119 files ranked A, including one
scoring 19.9. Skip it.

## ruff

```sh
ruff check --select FURB --statistics $PKG tests        # what a family would touch
ruff check --select FURB --fix --diff $PKG tests        # the safe fixes, not written
ruff check --select FURB --fix $PKG tests               # write them; then the suite
ruff check --select FURB --unsafe-fixes --diff $PKG     # read only; apply by hand, one by one
```

`--statistics` prints one line per rule: count, code, `[*]` if fixable, name, then
`[*] 4 fixable with --fix (2 unsafe fixes available with --fix --unsafe-fixes)`.

- Run inside the project so its `pyproject.toml` applies (`target-version`, `exclude`,
  `per-file-ignores`, `ignore`). `--select` replaces the configured rule list for that run; the
  ignores still apply. Don't pass `--isolated`.
- Look at `[tool.ruff.lint] select` first. A family it already lists is clean in CI and gives
  nothing; note it as skipped. In the first target, UP, SIM, C4, RET and PIE were already enforced,
  and only FURB and PERF found anything (four hits).
- `--fix` applies only fixes ruff marks safe. Unsafe ones are unsafe for a reason: SIM103 rewrites
  `if cond: return True / else: return False` as `return cond`, which returns whatever `cond` is;
  SIM118 drops `.keys()` from something that may not be a dict; C408, RET501, PERF101 and UP035 can
  drop comments. Read each one, and apply it only if the return type or comment survives.
- A family with no fixable hits (PERF401/403, the manual comprehensions) is a hand edit: one
  commit for the family, the suite after.
- `ERA001` (commented-out code) has no fix. It also fires on comments that show an example. Delete
  real dead code; leave the rest.
- After removing code, run `ruff check --select RUF100 --fix` if the project uses `noqa`: a
  suppression that no longer applies is now noise. That is its own commit.

## vulture

```sh
vulture $PKG tests --min-confidence 60 \
  --ignore-decorators '@*.tool,@*.resource,@*.prompt,@*.route,@*.get,@*.post,@*.put,@*.delete' \
  --ignore-names 'on_*,model_config' --sort-by-size > .refactor/vulture.txt
```

Output: `path:line: unused function 'name' (60% confidence, 11 lines)`. 60% is every function,
method, attribute and variable it cannot see a call to; 100% is unreachable code after a `return`,
and is rare.

- Include `tests` in the paths. Without it, everything only tests call is listed. A function only
  tests call is a test-only seam: deleting it deletes those tests too, so it is a test change.
- In the first target: 141 hits on the package alone, 93 with tests included, 24 after the
  decorator ignores, and all 24 were framework hooks, pydantic settings or attributes set on a
  library's object. Expect the true positives to be a handful.
- Before removing a name, all of these come back empty:

  ```sh
  git grep -nw 'name' -- ':!*.lock'      # any use, any file type: templates, JS, YAML, docs
  git grep -n "['\"]name['\"]"           # string use: getattr, registries, entry points
  ```

  and its definition has no decorator, is not an override of a base class method, and is not
  listed in `pyproject.toml` entry points.

## deptry

```sh
deptry . > .refactor/deptry.txt 2>&1; grep -c DEP .refactor/deptry.txt
```

Run it in the project's installed environment; it maps package names to import names from what is
installed. Lines read `pyproject.toml: DEP002 'requests' defined as a dependency but not used in
the codebase`. Codes: DEP001 imported but not declared, DEP002 declared but not imported, DEP003
imported but only a transitive dependency, DEP004 dev dependency used in code. Only DEP002 removes
anything. It is wrong for packages used without an import: a server run from the command line
(`uvicorn`), a pytest plugin, a database driver named in a URL, an extra. Grep the Dockerfile,
CI files and config for the name, and build the image before committing.

## Duplicate blocks

```sh
symilar -d 6 -i --ignore-docstrings --ignore-imports --ignore-signatures $(git ls-files "$PKG/*.py")
pylint --disable=all --enable=duplicate-code --min-similarity-lines=6 $PKG    # same engine
```

Output: `8 similar lines in 2 files`, then `==path:[start:end]` for each copy, the lines, and a last
line `TOTAL lines=38658 duplicates=15 percent=0.04`.

- `symilar` takes files, not directories, and ignores nothing unless told; pylint ignores comments,
  docstrings, imports and signatures by default. Without the flags, matching docstrings and
  parameter lists dominate the output.
- Both compare one file with another, never a file with itself. Repeats inside one module are not
  found; read the module.
- Token-level clones are rare in a reviewed codebase (0.04% at six lines in the first target). The
  real repetition is shape: the same argument list passed through three layers, the same
  `try/except` wrapping, the same response dict. Look for it with `git grep -c` on a distinctive
  line, not with a clone detector.

## Complexity

```sh
radon cc -j -n C $PKG > .refactor/cc.json
jq -r 'to_entries[] | .key as $f | .value[] | "\(.rank) \(.complexity) \($f):\(.lineno) \(.name)"' \
  .refactor/cc.json | sort -k2 -nr | head -20
```

Ranks: A 1-5, B 6-10, C 11-20, D 21-30, E 31-40, F 41+. A function at D or worse is worth reading
for a table hiding in a chain of branches. A high score from one flat `match` or a validation list
is fine as it is.

## Tests and coverage

```sh
pytest -q -x -p no:randomly                                   # after each commit
pytest -q --cov=$PKG --cov-branch --cov-report=json:.refactor/cov.json
jq '.totals.percent_covered, (.files["src/mypkg/x.py"].summary.percent_covered)' .refactor/cov.json
```

Which lines only one test covers, before deleting it:

```sh
pytest -q -p no:randomly --cov=$PKG --cov-context=test tests/test_x.py
coverage json --show-contexts -o .refactor/ctx.json
jq -r --arg t 'tests/test_x.py::test_name|run' \
  '.files | to_entries[] | .key as $f | .value.contexts | to_entries[]
   | select(.value == [$t]) | "\($f):\(.key)"' .refactor/ctx.json
```

Empty output means no line depends on that test alone. It still needs a named keeper for the
behaviour: coverage counts lines run, not results checked.

## Flaky tests

```sh
pytest -p randomly 2>&1 | tee .refactor/random.txt | grep -m1 randomly-seed   # not -q: it hides the seed
pytest -q -p randomly --randomly-seed=1234 tests/test_x.py     # replay that order
pytest -q -p no:randomly --count=50 -x tests/test_x.py::test_y # pytest-repeat: run one 50 times
```

`--randomly-seed=last` needs pytest's cache; a run with `-p no:cacheprovider` cannot replay, so
copy the seed from the header. `--count` with `-x` stops at the first failure, which makes a race
that fires one time in twenty visible in seconds. A test that fails only in random order depends
on another test's state; one that fails under `--count` alone is a race or a real-time wait.

## Mutation testing, on one module

Optional, for a module where you plan to delete or merge tests. mutmut 3 runs on Linux and macOS,
copies the project into `mutants/` (add it to `.git/info/exclude`) and is configured in
`pyproject.toml`; keep that block out of commits.

```toml
[tool.mutmut]
source_paths = ["src/mypkg"]
only_mutate = ["src/mypkg/x.py"]
pytest_add_cli_args_test_selection = ["tests/test_x.py"]
```

```sh
mutmut run && mutmut results --all true > .refactor/mut-before.txt
mutmut export-cicd-stats && cat mutants/mutmut-cicd-stats.json   # {"killed": 2, "survived": 6, ...}
mutmut show mypkg.x.x_name__mutmut_1                              # the diff of one mutant
```

Run it before and after the test change. A mutant killed before and surviving after is a behaviour
the deleted test held. mutmut skips decorated functions (other than a lone `@staticmethod` or
`@classmethod`), so a framework's tool handlers are not mutated; the helpers they call are. On a
few hundred lines it takes minutes; on a whole service it is not practical. cosmic-ray is the
heavier alternative and needs a session file; it is not covered here.

## ast_same.py

```sh
python3 scripts/ast_same.py HEAD [paths...]      # working tree, staged and untracked, against HEAD
python3 scripts/ast_same.py HEAD~1..HEAD         # one commit
for c in $(git rev-list base..HEAD); do python3 scripts/ast_same.py $c~1..$c || echo $c; done
```

Prints `ok: N changed .py files, comments and docstrings only` and exits 0, or one line per file
(`code changed`, `file added`, `does not parse`, `a comment that a tool reads changed`) and exits 1.
It lists every changed docstring as `path: docstring changed: Class.method`; check none is a tool's
or an endpoint's. Comments tools read (`noqa`, `type:`, `pragma`, `pylint:`, `fmt:`, a shebang)
count as code. Replacing a docstring-only body with `pass` fails: keep a docstring or `...` as it
was.
