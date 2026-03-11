# esq

A fast, read-only CLI for querying Elasticsearch and OpenSearch clusters from the terminal. Search, aggregate, explore, and export — without writing JSON by hand.

Built with [Bun](https://bun.sh), [Bunli](https://bunli.dev), and the [OpenSearch JS client](https://github.com/opensearch-project/opensearch-js).

## Install

```bash
bun install
bun link   # makes `esq` available globally
```

## Quick Start

```bash
# Point at your cluster
echo 'ES_HOST=https://localhost:9200\nES_USER=elastic\nES_PASSWORD=changeme' > .env

# Search
esq search -i my-index -q "landscape painting" -f table

# Count
esq count -i my-index

# Top values
esq aggs -i my-index --field category.keyword -f table
```

If your `.env` uses non-standard variable names (e.g. `FAMSF_OPENSEARCH_URL`), generate a project file to avoid repeating flags:

```bash
esq init -y   # scans .env, writes .esq with mappings + default index
esq search -q "monet" -f table   # just works
```

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `search` | `s` | Full-text search with query string or raw JSON |
| `count` | `c` | Count documents, optionally filtered |
| `aggs` | `a` | Terms aggregation on a field |
| `histogram` | `hist` | Histogram aggregation with bar chart output |
| `suggest` | — | Term suggestions (did-you-mean / typo correction) |
| `knn` | — | kNN vector similarity search |
| `doc` | `d` | Get a single document by ID |
| `mapping` | `m` | Show field mappings for an index |
| `indices` | `ls` | List all indices with health and doc counts |
| `raw` | — | Send any read-only GET/POST request |
| `init` | — | Generate a `.esq` project file from `.env` |

### Search

```bash
esq search -q "landscape painting" -f table
esq search -q "artist:Monet AND department:European" -f table
esq search -q "title:watir~" -f table                     # fuzzy (typo-tolerant)
esq search -q "title:water*" -f table                     # wildcard
esq search -q 'title:"water lilies"' -f table             # exact phrase
esq search -q "year:[1800 TO 1900]" -f table              # range
esq search -q "monet" --fields title,artist -f table      # include fields
esq search -q "monet" -x embedding,vectors -f table       # exclude fields
esq search -q "monet" --sort date:desc -n 20              # sort + limit
```

The `-q` flag accepts [query string syntax](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html#query-string-syntax) or raw JSON for complex queries.

### Aggregations

```bash
esq aggs --field department.keyword -n 30 -f table
esq aggs --field department.keyword -q "year:[1800 TO 1900]" -o results.tsv
```

### Histogram

```bash
esq hist --field year --interval 50 -q "year:[1800 TO 2000]"
esq hist --field created_at --interval month
esq hist --field price --interval 100 -w 60 -f bar
```

Supports calendar intervals (`year`, `quarter`, `month`, `week`, `day`) and fixed intervals (`30d`, `12h`). Default output is a Unicode bar chart.

### Suggest

```bash
esq suggest --field title --text "picaso painitng"
# Did you mean: picasso painting
#   picaso → picasso (18), pictio (1)
#   painitng → painting (33), printing (18)

esq suggest --field artist_names --text "vangogh" -f table
```

### kNN Vector Search

```bash
esq knn --field embedding --vector '[0.1, 0.2, ...]' -k 10
esq knn --field embedding --vector '[0.1, 0.2, ...]' --filter "department:paintings"
```

### Raw Requests

For any read-only endpoint not covered by other commands:

```bash
esq raw -X GET -p "/_cluster/health"
esq raw -X POST -p "/my-index/_search" -d @query.json
esq raw -X GET -p "/_cat/aliases?format=json" -f table
```

Write operations (PUT, DELETE) are blocked.

## Output Formats

| Flag | Format | Notes |
|------|--------|-------|
| `-f json` | JSON | Full response, pretty-printed |
| `-f table` | Table | Hits or buckets as aligned columns (default for most commands) |
| `-f tsv` | TSV | Tab-separated, suitable for spreadsheets or `duckdb` |
| `-f markdown` | Markdown | Pipe-delimited table |
| `-f bar` | Bar chart | Unicode block chart (histogram only) |

### File Export

Most commands support `-o` to write directly to a file. The format is inferred from the extension:

```bash
esq search -q "monet" --fields title,artist -o results.tsv
esq search -q "monet" --fields title,artist -o results.parquet
esq search -q "monet" --fields title,artist -o results.md
esq aggs --field department.keyword -o departments.json
```

Parquet export pipes through [DuckDB](https://duckdb.org/) (must be on PATH).

## Configuration

### `.env` file

```env
# Direct connection
ES_HOST=https://localhost:9200
ES_USER=elastic
ES_PASSWORD=changeme

# Elastic Cloud
ES_CLOUD_ID=my-deployment:base64string
ES_API_KEY=your-api-key
```

`-e` defaults to `.env` in the current directory.

### `.esq` project file

Maps non-standard env var names and sets a default index:

```
# esq project config
ES_HOST=MY_OPENSEARCH_URL
ES_USER=MY_OPENSEARCH_USERNAME
ES_PASSWORD=MY_OPENSEARCH_PASSWORD
INDEX=my-default-index
```

Generate with `esq init` or `esq init -y` (non-interactive).

### `--var` flag

For one-off remapping without a project file:

```bash
esq search -i my-index --var "ES_HOST=MY_HOST,ES_USER=MY_USER,ES_PASSWORD=MY_PASS"
```

## Development

```bash
bun test          # run unit tests
bun run dev       # bunli dev mode
```

Commands are auto-discovered from `commands/`. Add a new `.ts` file and it's immediately available — no registration needed. See [CLAUDE.md](CLAUDE.md) for the command template and conventions.

