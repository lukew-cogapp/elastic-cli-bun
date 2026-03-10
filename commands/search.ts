import { defineCommand, option } from "@bunli/core"
import { z } from "zod/v4"
import { connect, connectionOptions } from "../src/connect.ts"
import { formatOutput, writeOutput, inferFormat } from "../src/output.ts"

export default defineCommand({
  name: "search",
  description: "Search an index (query string or JSON body)",
  alias: "s",
  options: {
    ...connectionOptions,
    index: option(z.string().optional(), {
      description: "Index name (defaults to .esq INDEX)",
      short: "i",
    }),
    query: option(z.string().default("*"), {
      description: 'Query string or JSON body (default: "*")',
      short: "q",
    }),
    size: option(z.coerce.number().int().positive().default(10), {
      description: "Number of results",
      short: "n",
    }),
    from: option(z.coerce.number().int().default(0), {
      description: "Offset for pagination",
    }),
    fields: option(z.string().optional(), {
      description: "Comma-separated source fields to return",
    }),
    exclude: option(z.string().optional(), {
      description: "Comma-separated fields to exclude from results",
      short: "x",
    }),
    sort: option(z.string().optional(), {
      description: "Sort (e.g. date:desc,title:asc)",
    }),
    format: option(z.enum(["json", "table", "tsv", "markdown"]).default("table"), {
      description: "Output format",
      short: "f",
    }),
    output: option(z.string().optional(), {
      description: "Write results to file (supports .tsv, .parquet, .md, .json)",
      short: "o",
    }),
  },
  handler: async ({ flags }) => {
    const { client, defaultIndex } = connect(flags)
    const index = flags.index ?? defaultIndex
    if (!index) throw new Error("No index specified. Use -i or set INDEX in .esq")

    const body = buildSearchBody(flags)
    const result = await client.search({ index, body })

    if (flags.output) {
      writeOutput(result, inferFormat(flags.output, flags.format), flags.output)
    } else {
      console.log(formatOutput(result, flags.format))
    }
  },
})

function buildSearchBody(opts: {
  query: string
  size: number
  from: number
  fields?: string
  exclude?: string
  sort?: string
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    size: opts.size,
    from: opts.from,
  }

  // Try parsing as JSON first (raw query body)
  try {
    const parsed = JSON.parse(opts.query)
    if (typeof parsed === "object" && parsed !== null) {
      return { ...body, ...parsed }
    }
  } catch {
    // Not JSON — treat as query string
  }

  if (opts.query === "*" || opts.query === "") {
    body.query = { match_all: {} }
  } else {
    body.query = { query_string: { query: opts.query } }
  }

  if (opts.fields || opts.exclude) {
    if (opts.fields && opts.exclude) {
      body._source = { includes: opts.fields.split(","), excludes: opts.exclude.split(",") }
    } else if (opts.fields) {
      body._source = opts.fields.split(",")
    } else {
      body._source = { excludes: opts.exclude!.split(",") }
    }
  }

  if (opts.sort) {
    body.sort = opts.sort.split(",").map((s) => {
      const [field, order] = s.split(":")
      return order ? { [field!]: order } : field
    })
  }

  return body
}
