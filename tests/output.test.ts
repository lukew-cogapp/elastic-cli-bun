import { describe, expect, test } from "bun:test"
import { formatOutput, extractRows, inferFormat } from "../src/output.ts"

// --- extractRows ---

describe("extractRows", () => {
  test("extracts search hits with _source", () => {
    const data = {
      hits: {
        total: { value: 2 },
        hits: [
          { _id: "1", _index: "idx", _source: { title: "Monet", year: 1908 } },
          { _id: "2", _index: "idx", _source: { title: "Renoir", year: 1910 } },
        ],
      },
    }
    const rows = extractRows(data)
    expect(rows).toHaveLength(2)
    expect(rows![0]).toEqual({ _id: "1", _index: "idx", title: "Monet", year: 1908 })
    expect(rows![1]).toEqual({ _id: "2", _index: "idx", title: "Renoir", year: 1910 })
  })

  test("extracts aggregation buckets", () => {
    const data = {
      hits: { total: { value: 0 }, hits: [] },
      aggregations: {
        result: {
          buckets: [
            { key: "Paintings", doc_count: 100 },
            { key: "Prints", doc_count: 50 },
          ],
        },
      },
    }
    const rows = extractRows(data)
    expect(rows).toHaveLength(2)
    expect(rows![0]).toEqual({ key: "Paintings", doc_count: 100 })
  })

  test("prioritises aggregations over empty hits", () => {
    const data = {
      hits: { total: { value: 1000 }, hits: [] },
      aggregations: {
        result: {
          buckets: [{ key: "A", doc_count: 10 }],
        },
      },
    }
    const rows = extractRows(data)
    expect(rows).toHaveLength(1)
    expect(rows![0]!.key).toBe("A")
  })

  test("returns null for non-object data", () => {
    expect(extractRows(null)).toBeNull()
    expect(extractRows(42)).toBeNull()
    expect(extractRows("hello")).toBeNull()
  })

  test("handles raw array input", () => {
    const data = [
      { name: "a", value: 1 },
      { name: "b", value: 2 },
    ]
    const rows = extractRows(data)
    expect(rows).toHaveLength(2)
  })

  test("filters non-object items from array", () => {
    const data = [{ name: "a" }, 42, "string", null, { name: "b" }]
    const rows = extractRows(data)
    expect(rows).toHaveLength(2)
  })

  test("returns null when no hits or aggregations", () => {
    expect(extractRows({})).toBeNull()
    expect(extractRows({ something: "else" })).toBeNull()
  })

  test("handles hit without _source", () => {
    const data = {
      hits: {
        hits: [{ _id: "1", _index: "idx" }],
      },
    }
    const rows = extractRows(data)
    expect(rows).toHaveLength(1)
    expect(rows![0]).toEqual({ _id: "1", _index: "idx" })
  })
})

// --- formatOutput: JSON ---

describe("formatOutput json", () => {
  test("returns pretty-printed JSON", () => {
    const data = { a: 1, b: "hello" }
    const result = formatOutput(data, "json")
    expect(JSON.parse(result)).toEqual(data)
    expect(result).toContain("\n")
  })
})

// --- formatOutput: table ---

describe("formatOutput table", () => {
  test("renders table with header separator and rows", () => {
    const data = {
      hits: {
        hits: [
          { _id: "1", _index: "i", _source: { title: "Monet" } },
        ],
      },
    }
    const result = formatOutput(data, "table")
    const lines = result.split("\n")
    expect(lines).toHaveLength(3) // header, separator, 1 row
    expect(lines[0]).toContain("_id")
    expect(lines[0]).toContain("title")
    expect(lines[1]).toContain("─")
    expect(lines[2]).toContain("Monet")
  })

  test("falls back to JSON when no rows extracted", () => {
    const data = { custom: "response" }
    const result = formatOutput(data, "table")
    expect(JSON.parse(result)).toEqual(data)
  })

  test("truncates long values to 60 chars", () => {
    const longVal = "x".repeat(100)
    const data = {
      hits: {
        hits: [{ _id: "1", _index: "i", _source: { title: longVal } }],
      },
    }
    const result = formatOutput(data, "table")
    // Truncated value should end with ellipsis and be at most 60 chars
    const lines = result.split("\n")
    const row = lines[2]!
    expect(row).toContain("…")
    expect(row).not.toContain(longVal)
  })
})

// --- formatOutput: TSV ---

describe("formatOutput tsv", () => {
  test("renders tab-separated header and rows", () => {
    const data = {
      hits: {
        hits: [
          { _id: "1", _index: "i", _source: { title: "Monet", year: 1908 } },
          { _id: "2", _index: "i", _source: { title: "Renoir", year: 1910 } },
        ],
      },
    }
    const result = formatOutput(data, "tsv")
    const lines = result.split("\n")
    expect(lines).toHaveLength(3) // header + 2 rows
    expect(lines[0]!.split("\t")).toContain("title")
    expect(lines[1]!.split("\t")).toContain("Monet")
  })

  test("replaces tabs and newlines in values", () => {
    const data = {
      hits: {
        hits: [
          { _id: "1", _index: "i", _source: { title: "has\ttab\nnewline" } },
        ],
      },
    }
    const result = formatOutput(data, "tsv")
    const dataLine = result.split("\n")[1]!
    expect(dataLine).not.toContain("\t\t") // no double tabs from embedded tab
  })

  test("serializes objects as JSON in TSV cells", () => {
    const data = {
      hits: {
        hits: [
          { _id: "1", _index: "i", _source: { meta: { nested: true } } },
        ],
      },
    }
    const result = formatOutput(data, "tsv")
    expect(result).toContain('{"nested":true}')
  })
})

// --- formatOutput: markdown ---

describe("formatOutput markdown", () => {
  test("renders markdown table with pipes", () => {
    const data = {
      hits: {
        hits: [
          { _id: "1", _index: "i", _source: { title: "Monet" } },
        ],
      },
    }
    const result = formatOutput(data, "markdown")
    const lines = result.split("\n")
    expect(lines).toHaveLength(3) // header, separator, 1 row
    expect(lines[0]).toMatch(/^\|.*\|$/)
    expect(lines[1]).toMatch(/^\|.*---.*\|$/)
    expect(lines[2]).toContain("Monet")
  })

  test("escapes pipe characters in values", () => {
    const data = {
      hits: {
        hits: [
          { _id: "1", _index: "i", _source: { title: "A | B" } },
        ],
      },
    }
    const result = formatOutput(data, "markdown")
    expect(result).toContain("A \\| B")
  })
})

// --- inferFormat ---

describe("inferFormat", () => {
  test("infers format from file extension", () => {
    expect(inferFormat("results.tsv", "table")).toBe("tsv")
    expect(inferFormat("results.parquet", "table")).toBe("parquet")
    expect(inferFormat("results.md", "table")).toBe("markdown")
    expect(inferFormat("results.json", "table")).toBe("json")
  })

  test("falls back to provided default for unknown extensions", () => {
    expect(inferFormat("results.csv", "table")).toBe("table")
    expect(inferFormat("results.txt", "json")).toBe("json")
    expect(inferFormat("results", "tsv")).toBe("tsv")
  })

  test("handles paths with multiple dots", () => {
    expect(inferFormat("my.data.tsv", "table")).toBe("tsv")
    expect(inferFormat("output.2024.parquet", "table")).toBe("parquet")
  })
})
