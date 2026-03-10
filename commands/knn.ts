import { defineCommand, option } from "@bunli/core"
import { z } from "zod/v4"
import { connect, connectionOptions } from "../src/connect.ts"
import { formatOutput, writeOutput, inferFormat } from "../src/output.ts"

export default defineCommand({
  name: "knn",
  description: "kNN vector similarity search",
  options: {
    ...connectionOptions,
    index: option(z.string().optional(), {
      description: "Index name (defaults to .esq INDEX)",
      short: "i",
    }),
    field: option(z.string(), {
      description: "Vector field name",
    }),
    vector: option(z.string(), {
      description: "Query vector as JSON array",
    }),
    k: option(z.coerce.number().int().positive().default(10), {
      description: "Number of nearest neighbours",
    }),
    candidates: option(z.coerce.number().int().positive().default(100), {
      description: "Candidate pool size (num_candidates)",
    }),
    filter: option(z.string().optional(), {
      description: "Filter query (query string or JSON)",
    }),
    format: option(z.enum(["json", "table", "tsv", "markdown"]).default("table"), {
      description: "Output format",
      short: "f",
    }),
    output: option(z.string().optional(), {
      description: "Write results to file",
      short: "o",
    }),
  },
  handler: async ({ flags }) => {
    let vector: number[]
    try {
      vector = JSON.parse(flags.vector)
      if (!Array.isArray(vector)) throw new Error()
    } catch {
      throw new Error("--vector must be a JSON array of numbers")
    }

    const { client, defaultIndex } = connect(flags)
    const index = flags.index ?? defaultIndex
    if (!index) throw new Error("No index specified. Use -i or set INDEX in .esq")

    const knnQuery: Record<string, unknown> = {
      field: flags.field,
      query_vector: vector,
      k: flags.k,
      num_candidates: flags.candidates,
    }

    if (flags.filter) {
      try {
        knnQuery.filter = JSON.parse(flags.filter)
      } catch {
        knnQuery.filter = { query_string: { query: flags.filter } }
      }
    }

    const result = await client.search({ index, body: { knn: knnQuery } })

    if (flags.output) {
      writeOutput(result, inferFormat(flags.output, flags.format), flags.output)
    } else {
      console.log(formatOutput(result, flags.format))
    }
  },
})
