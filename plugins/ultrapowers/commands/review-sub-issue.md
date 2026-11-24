---
description: Review a sub-issue's pull request into its family's branch. A pass merges it there at once, so pass only what is ready, and leave the parent a summary.
---
Review this sub-issue's pull request: the whole branch against its base, the family's branch `issue-<P>`, as `skill://superpowers/requesting-code-review/SKILL.md`'s code reviewer does. Review it against the sub-issue's spec and plan and against the family's design on `issue-<P>`: a change that does its own part but bends the family's design is not done.

Your verdict decides a merge into `issue-<P>`, not into main. `looks good` approves and merges it at once, with no one reading it after you, so a pass carries no suggestion blocks: anything you would suggest is either a note for the parent in `output.summary`, or it is `changes requested`. With `looks good`, `output.summary` is required: three to six lines for the parent, on what this sub-issue delivered, anything it left for the family, and anything the next sub-issue must know.

Before you review, dispatch a subagent to security-review the diff in `.issue/diff.md`: injection, authentication and authorisation, secrets, unsafe deserialisation, data exposure. High-confidence findings only, each with its file, line, severity and fix; nothing in docs, and no denial of service or rate limiting. Weigh what it finds in your review: a real finding is a line comment, and one that must be fixed means changes requested.
