# Enrich

A streaming Dataflow job.

- Reads from the [events topic](#events) and joins each reading with its device's metadata.
- Writes rows to the [warehouse](#warehouse) through the BigQuery Storage Write API.
- Unparseable readings go to a dead-letter table for the on-call engineer.
