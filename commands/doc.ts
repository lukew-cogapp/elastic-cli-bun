import { defineCommand, option } from "@bunli/core"
import { z } from "zod/v4"
import { connect, connectionOptions } from "../src/connect.ts"
import { formatOutput, writeOutput, inferFormat } from "../src/output.ts"

export default defineCommand({
  name: "doc",
  description: "Get a single document by ID",
  alias: "d",
  options: {
    ...connectionOptions,
    index: option(z.string().optional(), {
      description: "Index name (defaults to .esq INDEX)",
      short: "i",
    }),
    id: option(z.string(), {
      description: "Document ID",
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

    const result = await client.getDoc({ index, id: flags.id })

    if (flags.output) {
      writeOutput(result, inferFormat(flags.output, flags.format), flags.output)
    } else {
      console.log(formatOutput(result, flags.format))
    }
  },
})
