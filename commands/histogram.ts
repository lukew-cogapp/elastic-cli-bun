import { defineCommand, option } from "@bunli/core"
import { z } from "zod/v4"
import { connect, connectionOptions } from "../src/connect.ts"
import { formatOutput } from "../src/output.ts"

export default defineCommand({
  name: "histogram",
  description: "Generate a histogram aggregation on a numeric or date field",
  alias: "hist",
  options: {
    ...connectionOptions,
    index: option(z.string().optional(), {
      description: "Index name (defaults to .esq INDEX)",
      short: "i",
    }),
    field: option(z.string(), {
      description: "Field to aggregate on (numeric or date)",
    }),
    interval: option(z.string().default("100"), {
      description: "Bucket interval (number for numeric, or calendar: year/quarter/month/week/day)",
    }),
    query: option(z.string().optional(), {
      description: "Filter query (query string or JSON)",
      short: "q",
    }),
    format: option(z.enum(["json", "table", "bar"]).default("bar"), {
      description: "Output format (bar chart is default)",
      short: "f",
    }),
    width: option(z.coerce.number().int().positive().default(50), {
      description: "Max bar width in characters",
      short: "w",
    }),
  },
  handler: async ({ flags }) => {
    const { client, defaultIndex } = connect(flags)
    const index = flags.index ?? defaultIndex
    if (!index) throw new Error("No index specified. Use -i or set INDEX in .esq")

    const calendarIntervals = new Set(["year", "quarter", "month", "week", "day", "hour", "minute"])
    const isCalendar = calendarIntervals.has(flags.interval)
    const isDate = isCalendar || flags.interval.endsWith("d") || flags.interval.endsWith("h") || flags.interval.endsWith("m") || flags.interval.endsWith("s")

    let aggBody: Record<string, unknown>
    if (isCalendar) {
      aggBody = {
        date_histogram: {
          field: flags.field,
          calendar_interval: flags.interval,
          min_doc_count: 1,
        },
      }
    } else if (isDate) {
      aggBody = {
        date_histogram: {
          field: flags.field,
          fixed_interval: flags.interval,
          min_doc_count: 1,
        },
      }
    } else {
      aggBody = {
        histogram: {
          field: flags.field,
          interval: Number(flags.interval),
          min_doc_count: 1,
        },
      }
    }

    const body: Record<string, unknown> = {
      size: 0,
      aggs: { result: aggBody },
    }

    if (flags.query) {
      try {
        body.query = JSON.parse(flags.query)
      } catch {
        body.query = { query_string: { query: flags.query } }
      }
    }

    const result = await client.search({ index, body })

    if (flags.format === "bar") {
      console.log(formatBarChart(result, flags.width))
    } else {
      console.log(formatOutput(result, flags.format === "table" ? "table" : "json"))
    }
  },
})

function formatBarChart(data: unknown, maxWidth: number): string {
  const obj = data as Record<string, unknown>
  const aggs = obj.aggregations as Record<string, unknown> | undefined
  if (!aggs) return JSON.stringify(data, null, 2)

  const result = aggs.result as Record<string, unknown> | undefined
  if (!result) return JSON.stringify(data, null, 2)

  const buckets = result.buckets as Array<Record<string, unknown>> | undefined
  if (!buckets || buckets.length === 0) return "No buckets returned."

  const maxCount = Math.max(...buckets.map((b) => b.doc_count as number))
  const maxLabel = Math.max(...buckets.map((b) => formatKey(b).length))
  const maxCountLen = String(maxCount).length

  const lines = buckets.map((bucket) => {
    const count = bucket.doc_count as number
    const barLen = maxCount > 0 ? Math.round((count / maxCount) * maxWidth) : 0
    const bar = "█".repeat(barLen)
    const label = formatKey(bucket).padEnd(maxLabel)
    const countStr = String(count).padStart(maxCountLen)
    return `${label}  ${bar} ${countStr}`
  })

  return lines.join("\n")
}

function formatKey(bucket: Record<string, unknown>): string {
  if (bucket.key_as_string) return String(bucket.key_as_string)
  return String(bucket.key)
}
