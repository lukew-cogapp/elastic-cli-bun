#!/usr/bin/env bun
import { createCLI } from "@bunli/core"
import { readdirSync } from "fs"
import { join } from "path"

const cli = await createCLI({
  name: "esq",
  version: "0.1.0",
  description: "Read-only Elasticsearch / OpenSearch CLI client",
})

// Auto-register all commands from ./commands/
const commandsDir = join(import.meta.dirname, "commands")
for (const file of readdirSync(commandsDir)) {
  if (!file.endsWith(".ts")) continue
  const mod = await import(join(commandsDir, file))
  cli.command(mod.default)
}

await cli.run()
