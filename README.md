# esq

Read-only CLI for querying Elasticsearch and OpenSearch clusters. Built with [Bunli](https://bunli.dev), [Bun](https://bun.sh), and the [OpenSearch JS client](https://github.com/opensearch-project/opensearch-js).

## Install

```bash
bun install
bun link   # makes `esq` available globally
```

## Setup

### Quick start with `.env`

Create a `.env` file with your cluster credentials:

```env
ES_HOST=https://localhost:9200
ES_USER=elastic
ES_PASSWORD=changeme
```

Or for Elastic Cloud:

```env
ES_CLOUD_ID=my-deployment:base64string
ES_API_KEY=your-api-key
```

### Project file (`.esq`)

If your `.env` uses different variable names, generate a `.esq` project file:

```bash
esq init        # interactive — detects vars and confirms
esq init -y     # auto-writes .esq
```

This creates a `.esq` file that maps your env vars and sets a default index:

```
ES_HOST=MY_OPENSEARCH_URL
ES_USER=MY_USERNAME
ES_PASSWORD=MY_PASSWORD
INDEX=my-default-index
```

With `.esq` in place, all commands work without extra flags.

## Commands

### Search

```bash
esq search -q "landscape painting" -f table
esq search -q "artist_names:Monet AND department:European" -f table
esq search -q "title:watir~" -f table                    # fuzzy matching
esq search -q "title:water*" -f table                    # wildcards
esq search -q 'title:"water lilies"' -f table            # phrase matching
esq search -q "begin_date:[1800 TO 1900]" -f table       # ranges
esq search -q "monet" --fields title,artist -f table     # include specific fields
esq search -q "monet" -x "embedding,vectors" -f table    # exclude fields
```

### Count

```bash
esq count
esq count -q "department:paintings"
```

### Aggregations

```bash
esq aggs --field department.keyword -n 30 -f table
esq aggs --field department.keyword -q "begin_date:[1800 TO 1900]"
```

### Histogram

```bash
esq hist --field begin_date --interval year -q "begin_date:[1800 TO 2000]"
esq hist --field price --interval 100 -w 60
```

### Suggest (did-you-mean)

```bash
esq suggest --field title --text "picaso painitng"
esq suggest --field artist_names --text "picaso" -f table
```

### Document lookup

```bash
esq doc --id abc123
```

### Mapping

```bash
esq mapping -i my-index
```

### List indices

```bash
esq indices -f table
```

### kNN vector search

```bash
esq knn --field embedding --vector '[0.1, 0.2, ...]' -k 10
esq knn --field embedding --vector '[0.1, 0.2, ...]' --filter "department:paintings"
```

### Raw request

```bash
esq raw -X GET -p "/_cluster/health"
esq raw -X POST -p "/my-index/_search" -d @query.json
```

## Output formats

- `-f json` — full JSON response
- `-f table` — extracted hits/buckets as a table (default for search, aggs, indices)
- `-f tsv` — tab-separated values
- `-f markdown` — Markdown table
- `-f bar` — bar chart (histogram only)

### Exporting to file

Use `-o` to write results to a file. Format is inferred from the extension:

```bash
esq search -q "monet" --fields title,artist_names -o results.tsv
esq search -q "monet" --fields title,artist_names -o results.parquet
esq search -q "monet" --fields title,artist_names -o results.md
esq aggs --field department.keyword -o departments.json
```

Parquet export requires [DuckDB](https://duckdb.org/) on your PATH.

## Adding commands

Drop a `.ts` file into `commands/` — it's auto-discovered. See [CLAUDE.md](CLAUDE.md) for the pattern.
