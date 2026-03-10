import { writeFileSync, existsSync } from "fs"
import { resolve } from "path"
import { config } from "dotenv"
import { defineCommand, option } from "@bunli/core"
import { z } from "zod/v4"

const HOST_PATTERNS = [/opensearch.*url/i, /elasticsearch.*url/i, /es.*host/i, /opensearch.*host/i, /elasticsearch.*host/i]
const USER_PATTERNS = [/opensearch.*user/i, /elasticsearch.*user/i, /es.*user/i]
const PASS_PATTERNS = [/opensearch.*pass/i, /elasticsearch.*pass/i, /es.*pass/i]
const API_KEY_PATTERNS = [/opensearch.*api.*key/i, /elasticsearch.*api.*key/i, /es.*api.*key/i]
const INDEX_PATTERNS = [/opensearch.*index/i, /elasticsearch.*index/i, /es.*index/i, /.*_index$/i]

function findMatch(keys: string[], patterns: RegExp[], exact: string[]): string | undefined {
  // Check exact matches first
  for (const e of exact) {
    if (keys.includes(e)) return e
  }
  // Then pattern matches
  for (const key of keys) {
    if (patterns.some((p) => p.test(key))) return key
  }
  return undefined
}

export default defineCommand({
  name: "init",
  description: "Generate a .esq project file from your .env",
  options: {
    env: option(z.string().default(".env"), {
      description: "Path to .env file to scan",
      short: "e",
    }),
    force: option(z.boolean().default(false), {
      description: "Overwrite existing .esq file",
    }),
    yes: option(z.boolean().default(false), {
      description: "Skip confirmation prompt",
      short: "y",
    }),
  },
  handler: async ({ flags, prompt, colors }) => {
    const esqPath = resolve(".esq")
    if (existsSync(esqPath) && !flags.force) {
      throw new Error(".esq already exists. Use --force to overwrite.")
    }

    const resolved = resolve(flags.env)
    const result = config({ path: resolved, quiet: true })
    if (result.error) {
      throw new Error(`Failed to read ${resolved}: ${result.error.message}`)
    }

    const env = result.parsed ?? {}
    const keys = Object.keys(env)

    if (keys.length === 0) {
      throw new Error(`No variables found in ${resolved}`)
    }

    // Auto-detect mappings
    const hostKey = findMatch(keys, HOST_PATTERNS, ["ES_HOST"])
    const userKey = findMatch(keys, USER_PATTERNS, ["ES_USER"])
    const passKey = findMatch(keys, PASS_PATTERNS, ["ES_PASSWORD"])
    const apiKeyKey = findMatch(keys, API_KEY_PATTERNS, ["ES_API_KEY"])
    const indexKey = findMatch(keys, INDEX_PATTERNS, [])

    console.log(colors.bold("\nDetected env vars:\n"))

    const detected: string[] = []
    if (hostKey) detected.push(`  ES_HOST     <- ${hostKey}`)
    if (userKey) detected.push(`  ES_USER     <- ${userKey}`)
    if (passKey) detected.push(`  ES_PASSWORD <- ${passKey}`)
    if (apiKeyKey) detected.push(`  ES_API_KEY  <- ${apiKeyKey}`)
    if (indexKey) detected.push(`  INDEX       <- ${indexKey} (${env[indexKey]})`)

    if (detected.length === 0) {
      console.log("  No matching variables found.\n")
      console.log(`Available vars in ${flags.env}:`)
      for (const key of keys) {
        console.log(`  ${key}`)
      }
      return
    }

    console.log(detected.join("\n"))
    console.log()

    const confirmed = flags.yes || await prompt.confirm("Write .esq file?")
    if (!confirmed) return

    // Build .esq content
    const lines: string[] = ["# esq project config — maps .env vars to ES credentials"]

    if (hostKey && hostKey !== "ES_HOST") lines.push(`ES_HOST=${hostKey}`)
    if (userKey && userKey !== "ES_USER") lines.push(`ES_USER=${userKey}`)
    if (passKey && passKey !== "ES_PASSWORD") lines.push(`ES_PASSWORD=${passKey}`)
    if (apiKeyKey && apiKeyKey !== "ES_API_KEY") lines.push(`ES_API_KEY=${apiKeyKey}`)
    if (indexKey && env[indexKey]) lines.push(`INDEX=${env[indexKey]}`)

    writeFileSync(esqPath, lines.join("\n") + "\n")
    console.log(colors.green(`\nWrote ${esqPath}`))
    console.log(`\nYou can now run: ${colors.bold("esq search -q 'your query'")}`)
  },
})
