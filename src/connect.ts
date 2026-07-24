import { option } from "@bunli/core"
import { join } from "path"
import { z } from "zod/v4"
import { loadConfig, loadEsqProject } from "./config.ts"
import { EsClient } from "./client.ts"

/**
 * Shared connection options for all commands.
 */
export const connectionOptions = {
  env: option(z.string().optional(), {
    description: "Path to .env file with ES credentials (default: <project>/.env)",
    short: "e",
  }),
  project: option(z.string().default("."), {
    description: "Directory containing the .esq file (default: current dir)",
    short: "p",
  }),
  var: option(z.string().optional(), {
    description: "Remap env var names (e.g. ES_HOST=MY_HOST,ES_USER=MY_USER)",
  }),
}

interface ConnectFlags {
  env?: string
  project?: string
  var?: string
  index?: string
}

/**
 * Create an EsClient from the shared --env, --project and --var flags.
 * Reads the .esq project file from --project (default: cwd). The .env
 * defaults to that same directory unless --env overrides it.
 */
export function connect(flags: ConnectFlags): { client: EsClient; defaultIndex?: string } {
  const projectDir = flags.project ?? "."
  const project = loadEsqProject(projectDir)

  // --var flag overrides .esq mappings
  const varMappings = flags.var ?? project?.mappings

  const envPath = flags.env ?? join(projectDir, ".env")
  const config = loadConfig(envPath, varMappings)
  const client = new EsClient(config)

  // Default index: explicit flag > .esq INDEX
  const defaultIndex = flags.index || project?.index

  return { client, defaultIndex }
}
