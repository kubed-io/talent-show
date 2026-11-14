---
tags: [natural-writing]
max_turns: 10
timeout_seconds: 600
allowed_tools: [Read, Skill]
---

I fixed issue #77, "The secrets listing is empty when one secrets directory is unreadable". While debugging I found that a PermissionError from `iterdir()` in `FilesystemSource.names` propagated up through `Catalogue._entries`, so one bad mount made `/secrets` return a 500 and no secret could be bound at all. I added a test, `test_an_unreadable_directory_is_skipped`, and the whole suite passes.

Here is the diff. Write the commit message and the pull request description for it. Then say whether the comment the diff adds should change, and if so, give the new one.

```diff
--- a/kubed/selenium_flow/secrets.py
+++ b/kubed/selenium_flow/secrets.py
@@ -192,9 +192,17 @@ class FilesystemSource:
     def names(self) -> list[str]:
-        if not self.root.is_dir():
-            return []
-        entries = list(self.root.iterdir())
+        try:
+            if not self.root.is_dir():
+                return []
+            entries = list(self.root.iterdir())
+        except OSError as exc:
+            # IMPORTANT — "Unreadable is absent" is a promise this module makes
+            # and did not keep: a PermissionError here propagated through
+            # Catalogue._entries and took down the whole catalogue rather than
+            # skipping one directory. This is exactly the bug from #77, and
+            # catching OSError here is deliberately broad.
+            log.warning("could not list %s: %s", self.root, exc)
+            return []
         found = []
         for path in entries:
```
