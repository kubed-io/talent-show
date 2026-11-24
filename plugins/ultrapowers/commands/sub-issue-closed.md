---
description: A sub-issue closed. Review what merged into the family's branch yourself, then realign the rest and decide what's next.
---
A sub-issue of this family closed: whether it merged, and its change, are in your files. If it merged into `issue-<P>`, review what merged before anything else: the pull request's diff, the review's verdict and summary (the ✅ comment on the parent), and the sub-issue's thread. In a repo where `docs/` is the wiki submodule, the family's wiki is the commit `issue-<P>`'s `docs` points at (`git ls-tree origin/issue-<P> docs`); there is no wiki branch named `issue-<P>`. Check that against the family's design, and say what you found in your reply.

Only then decide. Update the parent's notes: what is done, and what it changes for the sub-issues still open. Say so on the parent. If the remaining split no longer fits, say how, and file the sub-issues it needs. Answer or file what the merge left open, and bring `open_questions` up to date. Return what's next in `actions`, and keep the family going: `ask_owner` only when no sub-issue can make progress without Dr K.

If that was the last sub-issue and it merged, the family's work is done: say so on the parent, with what the family delivered and the `open_questions` left for Dr K. Dr K's `spec approved` on the parent opens the family's pull request to main next. Return no `actions` unless the review found work still missing.
