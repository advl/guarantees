# guarantees

The contract of a scheduler for a repository's guarantees, as data. `./contract` carries the version, the exit codes and the five schemas — the register, the runner's report, the probe, the freshness marker and the container labels — as objects, and `./contract/*.schema.json` carries the same five as committed files, the register's carrying the version and the exit codes inside it, emitted from one definition, so an implementation in another language reads a schema rather than a type.

## License

MIT
