import { config } from "dotenv"
import { existsSync, readFileSync } from "fs"
import { resolve } from "path"

export interface EsConfig {
  host: string
  apiKey?: string
  user?: string
  password?: string
  cloudId?: string
}

export interface EsqProject {
  mappings: string
  index?: string
}

/**
 * Load .esq project file if it exists.
 * Format: KEY=VALUE lines, where INDEX sets a default index
 * and ES_HOST/ES_USER/ES_PASSWORD/etc map to source env var names.
 */
export function loadEsqProject(dir: string = "."): EsqProject | null {
  const esqPath = resolve(dir, ".esq")
  if (!existsSync(esqPath)) return null

  const lines = readFileSync(esqPath, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))

  let index: string | undefined
  const mappingParts: string[] = []

  for (const line of lines) {
    const eq = line.indexOf("=")
    if (eq === -1) continue
    const key = line.slice(0, eq)
    const value = line.slice(eq + 1)
    if (key === "INDEX") {
      index = value
    } else {
      mappingParts.push(`${key}=${value}`)
    }
  }

  return {
    mappings: mappingParts.join(","),
    index,
  }
}

export function loadConfig(envPath: string, varMappings?: string): EsConfig {
  const resolved = resolve(envPath)
  const result = config({ path: resolved, quiet: true })

  if (result.error) {
    throw new Error(`Failed to load .env file: ${resolved}\n${result.error.message}`)
  }

  const env = result.parsed ?? {}

  // Apply --var mappings: "ES_HOST=FAMSF_OPENSEARCH_URL,ES_USER=FAMSF_OPENSEARCH_USERNAME"
  // reads the value of FAMSF_OPENSEARCH_URL from .env and uses it as ES_HOST, etc.
  if (varMappings) {
    for (const mapping of varMappings.split(",")) {
      if (!mapping) continue
      const eq = mapping.indexOf("=")
      if (eq === -1) {
        throw new Error(`Invalid --var format: "${mapping}" (expected KEY=SOURCE_KEY)`)
      }
      const target = mapping.slice(0, eq)
      const source = mapping.slice(eq + 1)
      if (env[source] !== undefined) {
        env[target] = env[source]
      }
    }
  }

  // Suffix-based auto-detection. If the canonical keys aren't set explicitly
  // (or via --var), fall back to any env var ENDING in `_ES_URL` / `_ES_API_KEY`
  // — so prefixed names like ELASTICO_ES_URL, CDK_ES_URL, FAMSF_ES_API_KEY work
  // with no .esq remap. A bare `ES_URL` is also accepted as an alias for ES_HOST.
  // Explicit ES_HOST / ES_API_KEY (or a --var mapping) always win.
  const findBySuffix = (suffix: string): string | undefined => {
    // Deterministic: shortest key first, then alphabetical, so the choice is
    // stable when several match (e.g. ES_URL beats ELASTICO_ES_URL).
    const keys = Object.keys(env)
      .filter((k) => k === suffix.slice(1) || k.endsWith(suffix))
      .sort((a, b) => a.length - b.length || a.localeCompare(b))
    for (const k of keys) {
      if (env[k]) return env[k]
    }
    return undefined
  }

  const host = env["ES_HOST"] ?? findBySuffix("_ES_URL")
  const cloudId = env["ES_CLOUD_ID"]

  if (!host && !cloudId) {
    throw new Error(
      `Missing ES_HOST, ES_CLOUD_ID, or a *_ES_URL var in ${resolved}\nSee .env.example for required variables.`,
    )
  }

  const esConfig: EsConfig = {
    host: cloudId ? cloudIdToHost(cloudId) : host!,
    apiKey: env["ES_API_KEY"] ?? findBySuffix("_ES_API_KEY"),
    user: env["ES_USER"],
    password: env["ES_PASSWORD"],
    cloudId,
  }

  return esConfig
}

/**
 * Elastic Cloud IDs encode the host as base64: `name:base64(host$es_id$kibana_id)`
 */
function cloudIdToHost(cloudId: string): string {
  const parts = cloudId.split(":")
  if (parts.length !== 2 || !parts[1]) {
    throw new Error(`Invalid ES_CLOUD_ID format: ${cloudId}`)
  }
  const decoded = atob(parts[1])
  const [host, esId] = decoded.split("$")
  if (!host || !esId) {
    throw new Error(`Invalid ES_CLOUD_ID payload: ${cloudId}`)
  }
  return `https://${esId}.${host}`
}
