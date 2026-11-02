# TASK: smoke test of the GitHub round trip

This is a connectivity test of the bridge between a local harness and this
repository. It is deliberately small. Do exactly what is asked below, nothing
more.

## What to do

1. Read this file (`TASK.md`) in the branch `task/smoke-test`.
2. Create a new file in the SAME branch, at the repository root, named
   `SMOKE-REPORT.md`.
3. Put the following content in it, exactly, replacing nothing:

```
STATUS: DONE

---RESULT---
The bridge works. This file was written by the Notion agent into the branch
task/smoke-test, and the local harness read it back from GitHub.
---END-RESULT---

---FILES---
SMOKE-REPORT.md
---END-FILES---
```

4. Commit it to the branch `task/smoke-test`. Do not open a pull request. Do not
   touch any other file. Do not modify `TASK.md`.

## Why

The local harness is testing whether a task can be handed over as a file in a
git branch, carried out remotely, and read back as a commit. The commit itself
is the proof that the work happened. A description of the work is not proof, so
the only thing that matters is that `SMOKE-REPORT.md` exists in this branch with
the content above.

## Rules

- Write only `SMOKE-REPORT.md`. Nothing else.
- Do not create `SMOKE-REPORT.md` anywhere except the root of this branch.
- If you cannot commit, say so plainly instead of describing a commit you did
  not make.
