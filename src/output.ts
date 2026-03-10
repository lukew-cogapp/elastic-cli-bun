import { writeFileSync, unlinkSync } from "fs"
import { spawnSync } from "child_process"

type Row = Record<string, unknown>

export type OutputFormat = "json" | "table" | "tsv" | "markdown"
export type WriteFormat = OutputFormat | "parquet"

export function formatOutput(data: unknown, format: OutputFormat): string {
  if (format === "json") {
    return JSON.stringify(data, null, 2)
  }
  if (format === "tsv") {
    return formatTsv(data)
  }
  if (format === "markdown") {
    return formatMarkdown(data)
  }
  return formatTable(data)
}

export function writeOutput(data: unknown, format: WriteFormat, outputPath: string): void {
  if (format === "parquet") {
    writeParquet(data, outputPath)
    return
  }
  const content = formatOutput(data, format)
  writeFileSync(outputPath, content, "utf-8")
  console.log(`Wrote ${outputPath}`)
}

export function inferFormat(path: string, fallback: OutputFormat): WriteFormat {
  if (path.endsWith(".parquet")) return "parquet"
  if (path.endsWith(".tsv")) return "tsv"
  if (path.endsWith(".md")) return "markdown"
  if (path.endsWith(".json")) return "json"
  return fallback
}

function formatTable(data: unknown): string {
  const rows = extractRows(data)
  if (!rows || rows.length === 0) {
    return JSON.stringify(data, null, 2)
  }

  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const stringRows = rows.map((row) =>
    columns.map((col) => {
      const val = row[col]
      if (val === null || val === undefined) return ""
      if (typeof val === "object") return JSON.stringify(val)
      return String(val)
    }),
  )

  const widths = columns.map((col, i) =>
    Math.min(
      60,
      Math.max(col.length, ...stringRows.map((r) => (r[i] ?? "").length)),
    ),
  )

  const header = columns.map((col, i) => col.padEnd(widths[i]!)).join("  ")
  const separator = widths.map((w) => "─".repeat(w)).join("──")
  const body = stringRows.map((row) =>
    row.map((val, i) => truncate(val, widths[i]!).padEnd(widths[i]!)).join("  "),
  )

  return [header, separator, ...body].join("\n")
}

function formatTsv(data: unknown): string {
  const rows = extractRows(data)
  if (!rows || rows.length === 0) {
    return JSON.stringify(data, null, 2)
  }

  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const header = columns.join("\t")
  const body = rows.map((row) =>
    columns.map((col) => {
      const val = row[col]
      if (val === null || val === undefined) return ""
      if (typeof val === "object") return JSON.stringify(val)
      return String(val).replace(/\t/g, " ").replace(/\n/g, " ")
    }).join("\t"),
  )

  return [header, ...body].join("\n")
}

function formatMarkdown(data: unknown): string {
  const rows = extractRows(data)
  if (!rows || rows.length === 0) {
    return JSON.stringify(data, null, 2)
  }

  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const header = `| ${columns.join(" | ")} |`
  const separator = `| ${columns.map(() => "---").join(" | ")} |`
  const body = rows.map((row) => {
    const cells = columns.map((col) => {
      const val = row[col]
      if (val === null || val === undefined) return ""
      if (typeof val === "object") return JSON.stringify(val)
      return String(val).replace(/\|/g, "\\|").replace(/\n/g, " ")
    })
    return `| ${cells.join(" | ")} |`
  })

  return [header, separator, ...body].join("\n")
}

function writeParquet(data: unknown, outputPath: string): void {
  const rows = extractRows(data)
  if (!rows || rows.length === 0) {
    throw new Error("No tabular data to write as Parquet")
  }

  // Validate paths don't contain characters that could break DuckDB SQL
  if (outputPath.includes("'") || outputPath.includes(";")) {
    throw new Error("Output path cannot contain single quotes or semicolons")
  }

  const jsonlPath = `${outputPath}.jsonl`
  const lines = rows.map((row) => JSON.stringify(row))

  try {
    writeFileSync(jsonlPath, lines.join("\n"), "utf-8")
    const result = spawnSync("duckdb", [
      "-c",
      `COPY (SELECT * FROM read_json_auto('${jsonlPath}')) TO '${outputPath}' (FORMAT PARQUET);`,
    ], { stdio: "pipe" })

    if (result.status !== 0) {
      throw new Error(`Failed to write Parquet (requires duckdb): ${result.stderr?.toString()}`)
    }
    console.log(`Wrote ${outputPath}`)
  } finally {
    try { unlinkSync(jsonlPath) } catch {}
  }
}

/**
 * Try to find tabular rows in common ES response shapes.
 */
export function extractRows(data: unknown): Row[] | null {
  if (Array.isArray(data)) return data.filter(isRow)

  if (typeof data !== "object" || data === null) return null
  const obj = data as Record<string, unknown>

  // Aggregation buckets (check before hits — agg responses have empty hits)
  if (obj.aggregations || obj.aggs) {
    const aggs = (obj.aggregations ?? obj.aggs) as Record<string, unknown>
    for (const val of Object.values(aggs)) {
      if (typeof val === "object" && val !== null && "buckets" in (val as Row)) {
        const buckets = (val as Row).buckets
        if (Array.isArray(buckets)) return buckets
      }
    }
  }

  // Search hits
  if (obj.hits && typeof obj.hits === "object") {
    const hits = obj.hits as Record<string, unknown>
    if (Array.isArray(hits.hits)) {
      return hits.hits.map((hit: Record<string, unknown>) => {
        const source = (hit._source ?? {}) as Row
        return { _id: hit._id, _index: hit._index, ...source }
      })
    }
  }

  return null
}

function isRow(val: unknown): val is Row {
  return typeof val === "object" && val !== null && !Array.isArray(val)
}

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str
}
