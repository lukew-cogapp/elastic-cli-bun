import { defineCommand, option } from "@bunli/core"
import { z } from "zod/v4"
import { connect, connectionOptions } from "../src/connect.ts"
import { formatOutput } from "../src/output.ts"

export default defineCommand({
  name: "suggest",
  description: "Get term suggestions (did-you-mean) for a text input",
  options: {
    ...connectionOptions,
    index: option(z.string().optional(), {
      description: "Index name (defaults to .esq INDEX)",
      short: "i",
    }),
    text: option(z.string(), {
      description: "Text to get suggestions for",
      short: "t",
    }),
    field: option(z.string(), {
      description: "Field to suggest against",
    }),
    size: option(z.coerce.number().int().positive().default(5), {
      description: "Max suggestions per term",
      short: "n",
    }),
    format: option(z.enum(["json", "table", "inline"]).default("inline"), {
      description: "Output format (inline shows corrected query)",
      short: "f",
    }),
  },
  handler: async ({ flags }) => {
    const { client, defaultIndex } = connect(flags)
    const index = flags.index ?? defaultIndex
    if (!index) throw new Error("No index specified. Use -i or set INDEX in .esq")

    const body = {
      suggest: {
        suggestion: {
          text: flags.text,
          term: {
            field: flags.field,
            size: flags.size,
          },
        },
      },
    }

    const result = await client.search({ index, body: { size: 0, ...body } })

    if (flags.format === "inline") {
      console.log(formatInline(result, flags.text))
    } else if (flags.format === "table") {
      console.log(formatSuggestTable(result))
    } else {
      console.log(formatOutput(result, "json"))
    }
  },
})

function formatInline(data: unknown, original: string): string {
  const suggestions = extractSuggestions(data)
  if (!suggestions || suggestions.length === 0) return `No suggestions for: ${original}`

  const corrected = suggestions
    .map((s) => (s.options.length > 0 ? s.options[0]!.text : s.text))
    .join(" ")

  const changed = corrected !== original.toLowerCase()
  if (!changed) return `No corrections needed: ${original}`

  const lines = [`Did you mean: ${corrected}`, ""]
  for (const s of suggestions) {
    if (s.options.length > 0) {
      const alts = s.options.map((o) => `${o.text} (${o.freq})`).join(", ")
      lines.push(`  ${s.text} → ${alts}`)
    }
  }
  return lines.join("\n")
}

function formatSuggestTable(data: unknown): string {
  const suggestions = extractSuggestions(data)
  if (!suggestions || suggestions.length === 0) return "No suggestions returned."

  const rows: string[] = []
  for (const s of suggestions) {
    if (s.options.length === 0) {
      rows.push(`${s.text}  (no suggestions)`)
    } else {
      for (const o of s.options) {
        rows.push(`${s.text.padEnd(20)}  →  ${o.text.padEnd(20)}  score=${o.score.toFixed(2)}  freq=${o.freq}`)
      }
    }
  }
  return rows.join("\n")
}

interface SuggestTerm {
  text: string
  options: Array<{ text: string; score: number; freq: number }>
}

function extractSuggestions(data: unknown): SuggestTerm[] | null {
  const obj = data as Record<string, unknown>
  const suggest = obj.suggest as Record<string, unknown> | undefined
  if (!suggest) return null

  const suggestion = suggest.suggestion as SuggestTerm[] | undefined
  return suggestion ?? null
}
