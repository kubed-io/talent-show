"""Prove that a change to Python files touched only comments and docstrings.

usage: python3 ast_same.py <rev> [paths...]
       python3 ast_same.py <rev>..<rev> [paths...]

With one rev, compares that rev with the working tree (staged and unstaged edits, plus untracked
.py files). With A..B, compares commit A with commit B. Paths narrow the check, as in git diff.

Each changed .py file is parsed on both sides with its docstrings removed and the two trees are
compared. Comments that tools read (noqa, type:, pragma, pylint:, fmt:, a shebang, a coding line)
count as code. A file that was added, deleted or renamed fails.

Docstrings are the help text and, in some frameworks, a tool description a client reads, so every
changed docstring is listed: check none of them is one of those.

Exits 0 when every file matches, 1 when one differs, 2 on a usage or git error.
"""
import ast
import io
import re
import subprocess
import sys
import tokenize

DIRECTIVE = re.compile(r"#\s*(noqa|type:|pragma|pylint:|mypy:|pyright:|ruff:|fmt:|isort:)|-\*-")
EMPTIED = "__body_was_only_a_docstring__"
DOCSTRING_OWNERS = (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)


def git(*args):
    done = subprocess.run(["git", *args], capture_output=True, text=True)
    if done.returncode:
        print(f"git {' '.join(args)}: {done.stderr.strip()}", file=sys.stderr)
        sys.exit(2)
    return done.stdout


def changes(old, new, paths):
    """Yield (status, path) for every .py file that differs, paths relative to the repo root."""
    span = [f"{old}..{new}"] if new else [old]
    out = git("diff", "--name-status", "--no-renames", "-z", *span, "--", *paths)
    fields = out.split("\0")[:-1]
    for status, path in zip(fields[::2], fields[1::2], strict=True):
        if path.endswith(".py"):
            yield status, path
    if not new:
        untracked = git("ls-files", "--others", "--exclude-standard", "--full-name", "-z",
                        "--", *paths)
        for path in untracked.split("\0"):
            if path.endswith(".py"):
                yield "A", path


def source(rev, path, root):
    if rev:
        return git("show", f"{rev}:{path}")
    with open(f"{root}/{path}", encoding="utf-8") as f:
        return f.read()


def strip_docstrings(tree):
    """Remove docstrings in place; return {qualified name: docstring}."""
    found = {}

    def visit(node, prefix):
        if isinstance(node, DOCSTRING_OWNERS):
            name = prefix + getattr(node, "name", "<module>")
            body = node.body
            if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant) \
                    and isinstance(body[0].value.value, str):
                found[name] = body[0].value.value
                del body[0]
                if not body:
                    body.append(ast.Expr(ast.Name(EMPTIED, ast.Load())))
            prefix = "" if isinstance(node, ast.Module) else name + "."
        for child in ast.iter_child_nodes(node):
            visit(child, prefix)

    visit(tree, "")
    return found


def directives(text):
    lines = []
    for tok in tokenize.generate_tokens(io.StringIO(text).readline):
        if tok.type == tokenize.COMMENT and (DIRECTIVE.search(tok.string) or
                                              (tok.start[0] == 1 and tok.string.startswith("#!"))):
            lines.append(tok.string.strip())
    return lines


def compare(path, before, after):
    """Return (problem or None, names of changed docstrings)."""
    trees = []
    for side, text in (("before", before), ("after", after)):
        try:
            tree = ast.parse(text, path, type_comments=True)
        except SyntaxError as e:
            return f"{side}: does not parse: {e.msg} (line {e.lineno})", []
        # a `# type: ignore` is compared as text by directives(); its line moves with any
        # docstring above it, so the AST keeps only its tag
        tree.type_ignores = [ast.TypeIgnore(lineno=0, tag=t.tag) for t in tree.type_ignores]
        trees.append((tree, strip_docstrings(tree)))
    (old, old_docs), (new, new_docs) = trees
    if ast.dump(old) != ast.dump(new):
        return "code changed", []
    if directives(before) != directives(after):
        return "a comment that a tool reads changed (noqa, type:, pragma, shebang...)", []
    names = old_docs.keys() | new_docs.keys()
    return None, sorted(n for n in names if old_docs.get(n) != new_docs.get(n))


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__.strip())
        return 0 if argv else 2
    old, _, new = argv[0].partition("..")
    paths = argv[1:]
    root = git("rev-parse", "--show-toplevel").strip()
    failed = checked = 0
    for status, path in changes(old, new or None, paths):
        checked += 1
        if status != "M":
            what = {"A": "added", "D": "deleted"}.get(status[0], f"status {status}")
            print(f"{path}: file {what}; only edits to existing files can be proven")
            failed += 1
            continue
        problem, names = compare(path, source(old, path, root), source(new or None, path, root))
        if problem:
            print(f"{path}: {problem}")
            failed += 1
        for name in names:
            print(f"{path}: docstring changed: {name}")
    if failed:
        print(f"FAIL: {failed} of {checked} changed .py files differ in more than comments")
        return 1
    print(f"ok: {checked} changed .py files, comments and docstrings only")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
