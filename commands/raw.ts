import { readFileSync } from "fs"
import { defineCommand, option } from "@bunli/core"
import { z } from "zod/v4"
import { connect, connectionOptions } from "../src/connect.ts"
import { formatOutput, writeOutput, inferFormat } from "../src/output.ts"

export default defineCommand({
  name: "raw",
  description: "Send a raw read-only request (GET or POST to search endpoints)",
  options: {
    ...connectionOptions,
    method: option(z.enum(["GET", "POST", "get", "post"]).default("GET"), {
      description: "HTTP method (GET or POST)",
      short: "X",
    }),
    path: option(z.string(), {
      description: "Request path (e.g. /my-index/_search)",
      short: "p",
    }),
    body: option(z.string().optional(), {
      description: "JSON body (inline or @filename)",
      short: "d",
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
    const { client } = connect(flags)
    let body: unknown = undefined

    if (flags.body) {
      const bodyStr = flags.body.startsWith("@")
        ? readFileSync(flags.body.slice(1), "utf-8")
        : flags.body

      try {
        body = JSON.parse(bodyStr)
      } catch {
        throw new Error(`Invalid JSON body: ${bodyStr.slice(0, 100)}...`)
      }
    }

    const result = await client.raw(flags.method, flags.path, body)

    if (flags.output) {
      writeOutput(result, inferFormat(flags.output, flags.format), flags.output)
    } else {
      console.log(formatOutput(result, flags.format))
    }
  },
})
