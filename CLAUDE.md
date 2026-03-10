# esq — Elasticsearch / OpenSearch CLI

Read-only CLI for querying Elasticsearch and OpenSearch clusters.

## Tech Stack
- Runtime: Bun
- CLI framework: Bunli (`@bunli/core`)
- ES client: `@opensearch-project/opensearch`
- Validation: Zod v4
- Testing: `bun test` (tests in `tests/`)
- Language: TypeScript (strict)

## Project Structure
```
cli.ts              # Entry point — auto-discovers commands from commands/
commands/           # One file per command (auto-discovered)
src/client.ts       # EsClient wrapper around OpenSearch JS client
src/config.ts       # .env loading, .esq project file parsing, var remapping
src/connect.ts      # Shared connection options + connect() factory
src/output.ts       # Output formatting (json, table, tsv, markdown, parquet)
tests/              # Unit tests (bun test)
```

## Commands
aggs, count, doc, histogram, indices, init, knn, mapping, raw, search, suggest

## Adding Commands
Add a `.ts` file to `commands/` — it's auto-discovered. Use this pattern:
```typescript
import { defineCommand, option } from "@bunli/core"
import { z } from "zod/v4"
import { connect, connectionOptions } from "../src/connect.ts"
import { formatOutput, writeOutput, inferFormat } from "../src/output.ts"

export default defineCommand({
  name: "my-command",
  options: {
    ...connectionOptions,
    index: option(z.string().optional(), { description: "Index name", short: "i" }),
    format: option(z.enum(["json", "table", "tsv", "markdown"]).default("table"), {
      description: "Output format", short: "f",
    }),
    output: option(z.string().optional(), {
      description: "Write results to file", short: "o",
    }),
  },
  handler: async ({ flags }) => {
    const { client, defaultIndex } = connect(flags)
    const index = flags.index ?? defaultIndex
    // ... get result ...
    if (flags.output) {
      writeOutput(result, inferFormat(flags.output, flags.format), flags.output)
    } else {
      console.log(formatOutput(result, flags.format))
    }
  },
})
```

## Key Conventions
- **Read-only**: Never add write operations (PUT, DELETE, POST to non-search endpoints)
- **connectionOptions spread**: All commands use `...connectionOptions` for shared `-e`/`--var` flags
- **connect() factory**: Returns `{ client, defaultIndex }` — reads `.esq` project file automatically
- **Output functions**: `formatOutput()` for console, `writeOutput()` + `inferFormat()` for file export
- **--output / -o**: Available on most commands (not histogram or suggest). Format inferred from extension
- **.esq project file**: Maps custom env var names to ES_HOST/ES_USER/ES_PASSWORD, sets default INDEX
- **No manual command registration**: cli.ts dynamically imports all `.ts` files from commands/

## Testing
```bash
bun test           # run all tests
bun test tests/output.test.ts   # run specific test file
```

Tests cover: output formatting (all formats), config loading (.env, .esq, var mappings, cloud ID), and client read-only guards.

## Running
```bash
esq search -q "monet" -f table     # from a directory with .esq file
esq --help                          # list all commands
```
