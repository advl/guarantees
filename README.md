# guarantees

The pure half of a scheduler for a repository's guarantees. `parseRegister` reads the register of rows — one table per guarantee, its kind, its tier, its test file, its digest-pinned image, its budget — or refuses it wholesale, naming every fault by table, column and line. `readReport` reads the test runner's report into the numbers a verdict is judged by, `judgeRun` judges one run from that report and its freshness and never from an exit code, refusing to judge a run that left no report, a stale one or one in which nothing executed, and `toExitCode` maps a verdict or a refusal onto the contract's codes. `readProbe` reads the readings a measuring entry wrote, `computeP95` takes the measured windows of an entry run five times to a p95 by nearest rank, `computeBudget` turns a p95 into a budget by the one rule, and `rewriteRunBudget` writes the pair back into the register text as one replaced line. Nothing here touches the filesystem, the network, the clock or a process; the reading and writing around these functions belong to the caller.

The contract is published beside the code. `./contract` carries the version, the exit codes and the five schemas — the register, the runner's report, the probe, the freshness marker and the container labels — as objects, and `./contract/*.schema.json` carries the same five as committed files, the register's carrying the version and the exit codes inside it, emitted from one definition, so an implementation in another language reads a schema rather than a type.

## License

MIT
