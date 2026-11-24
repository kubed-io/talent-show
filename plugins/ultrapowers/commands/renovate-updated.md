---
description: Renovate pushed to its branch, a rebase or a newer version. Read the pull request again from the diff, redo the follow-up on the new head, and give a new verdict.
---
Renovate pushed to this pull request's branch: a rebase, or a newer version. Your earlier follow-up commit may be gone. Read the pull request again from its diff, not from your notes: the versions it moves now, and the release notes for any release that is new. Redo the follow-up on the new head, only what is not already there, then `kubectl build` main and the branch and check the diff is Renovate's version lines plus your change's intent. Give a new verdict.

Before you answer, make sure this conversation holds what a compact must keep: this repository's pins and their quirks, Dr K's answers, and what this pull request needed.
