---
name: natural-writing
description: Use when writing or editing prose that developers read, such as code comments, docstrings, commit messages, pull request descriptions, READMEs, AGENTS.md, wiki pages, specs and plans. Use it for a pass that trims comments or rewrites docs an agent wrote, and before committing any diff that adds prose.
---

# Natural writing

## The reader

Write for one person, and know who it is.

| Text | The reader |
|---|---|
| Comment, docstring | An engineer who knows the language better than you, opens this file in a year to change it, and has never seen the ticket, the spec or this conversation |
| Commit message | Someone running `git log` or `git blame` to learn why a line is the way it is |
| Pull request | A reviewer with ten minutes, deciding what to look at closely |
| README | A stranger deciding whether to use the project and how to start |
| Wiki page, spec | Whoever builds or operates from it, looking up one thing |
| AGENTS.md, a prompt | An agent that follows every sentence literally |

None of them shares your context and all of them read fast. Give them what they need and stop.

## The test

For every sentence: would the reader do anything differently without it? If not, delete it.
Deleting a comment never changes behaviour, so doubt about whether a line helps is a reason to cut it.

## Rules

1. Describe what is true now. How the code got here, what it replaced and what failed first belong
   in the commit message.
2. Say each fact once, where a reader will look for it: an invariant on the function that enforces
   it, a module's contract in its docstring, the reason for a change in its commit.
3. Give the specific fact and let it carry the weight. "A `UnicodeDecodeError` message quotes the
   byte it failed on" tells the reader more than "this matters for security".
4. Write plain declarative sentences in the present tense. Use `is`, `has` and `returns`. Name the
   actor when there is one.
5. Use one word for one thing, the word the code uses. Repeat it; a synonym reads as a second thing.
6. Show importance by position and length. The sentence that matters is short and comes first.
7. Follow the house style of the file (docstring layout, line width, a README's tone and emoji), and
   leave its tics behind. A file full of em dashes is no reason to add one.
8. When a phrase goes, rewrite the sentence around its fact. Swapping in a synonym starts a new tic.

## What a comment is for

| Keep | Cut |
|---|---|
| Why the obvious approach is wrong here, and what it would break | The code in English: "increment the counter", "chosen from what failed" |
| A trap in a library, platform or protocol | The story of the change or the debugging: "used to", "the fix is", "did not keep its promise" |
| A constraint from outside: a format, a limit, a consumer that relies on a name | Ticket, PR, review, task, ruling and line numbers (`#52`, `Task 5`, `ruling 12`, `§F1.27`, `(734-800)`) |
| Units, bounds, ownership, an invariant no type expresses | An argument with an earlier design, or a rejected option nobody would reach for |
| Anything a tool reads: `# noqa`, `# type: ignore`, pragmas, licence headers (keep verbatim) | The same rule repeated at every place it is applied |

A docstring's first line says what the function returns or does, for a caller. How it works goes in
comments inside the body. A one-line wrapper gets a one-line docstring or none. If a comment only
explains a confusing name in your own code, the fix is a rename; in a comments-only pass, list the
rename instead of making it.

## Habits to drop

Rewrite the sentence that carries a habit; removing the word alone leaves the shape. Each row is a
sample of its habit.

| Kind | Habit | Examples |
|---|---|---|
| Words | Labels of significance and intensity | deliberately, exactly, precisely, the whole point, crucially, notably, robust, seamless |
| Words | Inflated verbs where `is` or `has` would do | serves as, acts as, ensures, leverages, boasts |
| Sentence shapes | A contrast against a claim nobody made | "X, not Y", "not just X but Y", "Y rather than X", "A is not B" as a heading |
| Sentence shapes | A closing aphorism that restates the point | "A broken leash is still a leash." "Degradation is the point." |
| Sentence shapes | Staging before the fact | "That distinction is the whole fix:", "Here is the thing:", "Note that", "It is worth noting" |
| Structure | Lists of three by reflex, a closing summary, a heading over a two-line section | |
| Structure | Provenance up front: status banners, who ruled what and when, a ledger of commits | |
| Punctuation | Em dashes as an all-purpose joiner; chains of semicolons; nested parentheses | |
| Tone | Defending the code to a reviewer who is not there; hedges on a known fact; flattery | "which is safer and more accurate" |
| Markdown | Bold or CAPITALS for emphasis inside prose; a one-column table; emoji outside a README that already uses them | "**No caller ever sees a value.**", "IDENTIFIERS" |

In comments, docstrings and commit messages use no em dashes at all: a comma, colon, parentheses or
a new sentence does the job.

## By kind of text

| Text | Holds | Examples |
|---|---|---|
| Comment, docstring | The why, the trap, the constraint | [references/comments.md](references/comments.md) |
| Commit message | Subject: imperative, names the change, under 72 characters. Body: the problem, why this fix, anything surprising. References at the end | [references/commits-and-prs.md](references/commits-and-prs.md) |
| Pull request | What changes and why in a paragraph, how it was tested, where to look hardest | [references/commits-and-prs.md](references/commits-and-prs.md) |
| README | What it is, how to start, what it does well. Reasoning goes to the wiki or AGENTS.md | [references/docs.md](references/docs.md) |
| Wiki page, spec | Requirements and decisions as they stand, by symbol name, never by line number | [references/docs.md](references/docs.md) |

## Editing existing text

- Read the whole file first. Decide what each comment is for, then delete, shorten or move it.
- Delete before you reword. Reword only what passes the test.
- Keep every fact that passes. If you cannot tell whether one is still true, read the code; a fact
  you cannot check stays.
- Add no fact, number or reason that is not in the source or the code.
- In a comments pass, leave code, strings, log lines and error messages alone. Check with
  `python3 scripts/same_code.py <before.py> <after.py>`: it compares the code with docstrings
  stripped and counts comment and docstring lines.
- A fact worth keeping that is in the wrong place moves: history to the commit, design to the spec.

## Checklist for a finished diff

Run it over every added or changed line of prose.

- [ ] Each comment says something the code cannot.
- [ ] Each fact appears once.
- [ ] Nothing describes what used to be, outside a commit message or changelog.
- [ ] No ticket, PR, review, task, ruling or line-number references in code.
- [ ] No bold, capitals or emoji used for emphasis; no em dash in comments, docstrings or commits.
- [ ] No sentence that only says something matters, and no closing line that restates a paragraph.
- [ ] No contrast with a claim nobody made.
- [ ] The commit subject is imperative and names the change.
- [ ] No personal names, emails, hostnames or internal URLs. Examples use `example.com`.
- [ ] Read it once as the reader in the table above. Anything they would skip goes.
