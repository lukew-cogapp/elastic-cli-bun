import { defineCommand, option } from "@bunli/core"
import { z } from "zod/v4"
import { connect, connectionOptions } from "../src/connect.ts"
import { formatOutput, writeOutput, inferFormat } from "../src/output.ts"

export default defineCommand({
  name: "count",
  description: "Count documents in an index, optionally filtered",
  alias: "c",
  options: {
    ...connectionOptions,
    index: option(z.string().optional(), {
      description: "Index name (defaults to .esq INDEX)",
      short: "i",
    }),
    query: option(z.string().optional(), {
      description: "Filter query (query string or JSON)",
      short: "q",
    }),
    format: option(z.enum(["json", "table", "tsv", "markdown"]).default("json"), {
      description: "Output format",
      short: "f",
    }),
    output: option(z.string().optional(), {
      description: "Write results to file",
      short: "o",
    }),
  },
  handler: async ({ flags }) => {
    const { client, defaultIndex } = connect(flags)
    const index = flags.index ?? defaultIndex
    if (!index) throw new Error("No index specified. Use -i or set INDEX in .esq")

    const body: Record<string, unknown> = {}

    if (flags.query) {
      try {
        body.query = JSON.parse(flags.query)
      } catch {
        body.query = { query_string: { query: flags.query } }
      }
    }

    const result = await client.count({ index, body })

    if (flags.output) {
      writeOutput(result, inferFormat(flags.output, flags.format), flags.output)
    } else {
      console.log(formatOutput(result, flags.format))
    }
  },
})
