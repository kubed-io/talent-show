---
description: Renovate opened a pull request. Work out what the bump needs beyond the version, make it, prove the build diff, and give a verdict.
---
Renovate opened this pull request. Read its diff: every version it moved, from what to what, and the jump. Read the release and upgrade notes for every release in between, from the README's `## Upgrading` table and `## References`. Find what the bump needs beyond the version, make those changes and nothing else, then `kubectl build` main and the branch and check the diff is Renovate's version lines plus your change's intent. Give the verdict by the rule for a plain bump.

Before you answer, make sure this conversation holds what a compact must keep: this repository's pins and their quirks, Dr K's answers, and what this pull request needed.
