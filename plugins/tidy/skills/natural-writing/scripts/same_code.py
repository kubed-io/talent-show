"""Check that a comments-only edit left the code alone, and count what it cut.

Usage: python3 same_code.py BEFORE.py AFTER.py

Prints the comment and docstring lines in each file, then whether the two parse
to the same AST once docstrings are removed. Exits 1 when the code differs.
Comments are not in the AST, so only docstrings need stripping.
"""

import ast
import io
import sys
import tokenize
from pathlib import Path

DOCUMENTED = (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)


def _docstring(node):
    body = getattr(node, "body", None)
    if isinstance(node, DOCUMENTED) and body:
        first = body[0]
        value = getattr(first, "value", None)
        if isinstance(value, ast.Constant) and isinstance(value.value, str):
            return first
    return None


def counts(source: str) -> tuple[int, int]:
    """Lines holding a comment, and lines inside a docstring."""
    tokens = tokenize.generate_tokens(io.StringIO(source).readline)
    comments = {t.start[0] for t in tokens if t.type == tokenize.COMMENT}
    docs = 0
    for node in ast.walk(ast.parse(source)):
        doc = _docstring(node)
        if doc is not None:
            docs += doc.end_lineno - doc.lineno + 1
    return len(comments), docs


def code_only(source: str) -> str:
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if _docstring(node) is not None:
            node.body = node.body[1:] or [ast.Pass()]
    return ast.dump(tree)


def main(before_path: str, after_path: str) -> int:
    before = Path(before_path).read_text(encoding="utf-8")
    after = Path(after_path).read_text(encoding="utf-8")
    for path, source in ((before_path, before), (after_path, after)):
        comments, docs = counts(source)
        print(f"{path}: {comments} comment + {docs} docstring = {comments + docs} lines")
    same = code_only(before) == code_only(after)
    print("code unchanged" if same else "CODE CHANGED")
    return 0 if same else 1


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1], sys.argv[2]))
