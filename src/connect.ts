import { option } from "@bunli/core"
import { z } from "zod/v4"
import { loadConfig, loadEsqProject } from "./config.ts"
import { EsClient } from "./client.ts"

/**
 * Shared connection options for all commands.
 */
export const connectionOptions = {
  env: option(z.string().default(".env"), {
    description: "Path to .env file with ES credentials",
    short: "e",
  }),
  var: option(z.string().optional(), {
    description: "Remap env var names (e.g. ES_HOST=MY_HOST,ES_USER=MY_USER)",
  }),
}

interface ConnectFlags {
  env: string
  var?: string
  index?: string
}

/**
 * Create an EsClient from the shared --env and --var flags.
 * Auto-reads .esq project file for mappings and default index.
 */
export function connect(flags: ConnectFlags): { client: EsClient; defaultIndex?: string } {
  const project = loadEsqProject()

  // --var flag overrides .esq mappings
  const varMappings = flags.var ?? project?.mappings

  const config = loadConfig(flags.env, varMappings)
  const client = new EsClient(config)

  // Default index: explicit flag > .esq INDEX
  const defaultIndex = flags.index || project?.index

  return { client, defaultIndex }
}
