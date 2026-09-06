## Done

[The one concern this pull request carries, told as what it makes possible: "a register with a row at a tier no job runs is refused now", "a golden is updated through one named command now". Then the work that delivers it, drive-bys named. Where no user-visible capability changed — a refactor, a pipeline change — state what the change protects or makes cheaper instead; do not invent a user.]

## QA

[Commands a reviewer can run and the output they should see — reproducible commands beat prose claims. If the pipeline did not run, paste the local gate output; the pull request body is then the record that the gates were green.]

## Readiness

- [ ] The title is a conventional commit — it becomes the squash-merge subject.
- [ ] `bun run ci` passes locally.
- [ ] New behaviour lands together with the tests that pin it.
- [ ] No internal references or identity leakage — the history is a shipped artifact.
