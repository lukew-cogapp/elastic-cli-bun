import { defineCommand, option } from "@bunli/core"
import { z } from "zod/v4"
import { connect, connectionOptions } from "../src/connect.ts"
import { formatOutput, writeOutput, inferFormat } from "../src/output.ts"

export default defineCommand({
  name: "indices",
  description: "List all indices with health, doc count, and size",
  alias: "ls",
  options: {
    ...connectionOptions,
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
    const { client } = connect(flags)
    const result = await client.catIndices()

    if (flags.output) {
      writeOutput(result, inferFormat(flags.output, flags.format), flags.output)
    } else {
      console.log(formatOutput(result, flags.format))
    }
  },
})
