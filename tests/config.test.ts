import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from "fs"
import { join } from "path"
import { loadConfig, loadEsqProject } from "../src/config.ts"

const TMP = join(import.meta.dirname, ".tmp-config-test")

beforeEach(() => {
  mkdirSync(TMP, { recursive: true })
})

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true })
})

// --- loadConfig ---

describe("loadConfig", () => {
  test("loads ES_HOST from .env", () => {
    const envPath = join(TMP, ".env")
    writeFileSync(envPath, "ES_HOST=https://localhost:9200\n")
    const config = loadConfig(envPath)
    expect(config.host).toBe("https://localhost:9200")
  })

  test("loads user and password", () => {
    const envPath = join(TMP, ".env")
    writeFileSync(envPath, "ES_HOST=https://localhost:9200\nES_USER=elastic\nES_PASSWORD=changeme\n")
    const config = loadConfig(envPath)
    expect(config.user).toBe("elastic")
    expect(config.password).toBe("changeme")
  })

  test("loads API key", () => {
    const envPath = join(TMP, ".env")
    writeFileSync(envPath, "ES_HOST=https://localhost:9200\nES_API_KEY=my-key\n")
    const config = loadConfig(envPath)
    expect(config.apiKey).toBe("my-key")
  })

  test("throws when missing ES_HOST and ES_CLOUD_ID", () => {
    const envPath = join(TMP, ".env")
    writeFileSync(envPath, "SOME_VAR=value\n")
    expect(() => loadConfig(envPath)).toThrow("Missing ES_HOST, ES_CLOUD_ID, or a *_ES_URL var")
  })

  test("auto-detects a *_ES_URL / *_ES_API_KEY var without a mapping", () => {
    const envPath = join(TMP, ".env")
    writeFileSync(envPath, "ELASTICO_ES_URL=https://example.es.cloud:443\nELASTICO_ES_API_KEY=abc123\n")
    const config = loadConfig(envPath)
    expect(config.host).toBe("https://example.es.cloud:443")
    expect(config.apiKey).toBe("abc123")
  })

  test("accepts a bare ES_URL as an alias for ES_HOST", () => {
    const envPath = join(TMP, ".env")
    writeFileSync(envPath, "ES_URL=https://bare.es.cloud:443\n")
    expect(loadConfig(envPath).host).toBe("https://bare.es.cloud:443")
  })

  test("explicit ES_HOST wins over a *_ES_URL var", () => {
    const envPath = join(TMP, ".env")
    writeFileSync(envPath, "ES_HOST=https://explicit:443\nELASTICO_ES_URL=https://suffix:443\n")
    expect(loadConfig(envPath).host).toBe("https://explicit:443")
  })

  test("throws on missing .env file", () => {
    expect(() => loadConfig(join(TMP, "nonexistent.env"))).toThrow("Failed to load .env file")
  })

  test("applies var mappings", () => {
    const envPath = join(TMP, ".env")
    writeFileSync(envPath, "MY_HOST=https://custom:9200\nMY_USER=admin\nMY_PASS=secret\n")
    const config = loadConfig(envPath, "ES_HOST=MY_HOST,ES_USER=MY_USER,ES_PASSWORD=MY_PASS")
    expect(config.host).toBe("https://custom:9200")
    expect(config.user).toBe("admin")
    expect(config.password).toBe("secret")
  })

  test("throws on invalid var mapping format", () => {
    const envPath = join(TMP, ".env")
    writeFileSync(envPath, "ES_HOST=https://localhost:9200\n")
    expect(() => loadConfig(envPath, "BADFORMAT")).toThrow("Invalid --var format")
  })

  test("ignores var mappings for missing source keys", () => {
    const envPath = join(TMP, ".env")
    writeFileSync(envPath, "ES_HOST=https://localhost:9200\n")
    // MY_USER doesn't exist in .env — should not error, just skip
    const config = loadConfig(envPath, "ES_USER=MY_USER")
    expect(config.user).toBeUndefined()
  })
})

// --- loadConfig: Cloud ID ---

describe("loadConfig cloud ID", () => {
  test("converts cloud ID to host URL", () => {
    // Cloud ID format: name:base64(host$es_id$kibana_id)
    const payload = btoa("us-east-1.aws.found.io$abc123$def456")
    const envPath = join(TMP, ".env")
    writeFileSync(envPath, `ES_CLOUD_ID=my-deploy:${payload}\n`)
    const config = loadConfig(envPath)
    expect(config.host).toBe("https://abc123.us-east-1.aws.found.io")
  })

  test("throws on invalid cloud ID format", () => {
    const envPath = join(TMP, ".env")
    writeFileSync(envPath, "ES_CLOUD_ID=nocolon\n")
    expect(() => loadConfig(envPath)).toThrow("Invalid ES_CLOUD_ID format")
  })
})

// --- loadEsqProject ---

describe("loadEsqProject", () => {
  test("returns null when no .esq file exists", () => {
    expect(loadEsqProject(TMP)).toBeNull()
  })

  test("parses mappings and index from .esq", () => {
    const esqPath = join(TMP, ".esq")
    writeFileSync(esqPath, [
      "# comment",
      "ES_HOST=MY_HOST",
      "ES_USER=MY_USER",
      "ES_PASSWORD=MY_PASS",
      "INDEX=my-index",
    ].join("\n"))

    const project = loadEsqProject(TMP)
    expect(project).not.toBeNull()
    expect(project!.index).toBe("my-index")
    expect(project!.mappings).toBe("ES_HOST=MY_HOST,ES_USER=MY_USER,ES_PASSWORD=MY_PASS")
  })

  test("handles .esq with only INDEX", () => {
    const esqPath = join(TMP, ".esq")
    writeFileSync(esqPath, "INDEX=my-index\n")

    const project = loadEsqProject(TMP)
    expect(project).not.toBeNull()
    expect(project!.index).toBe("my-index")
    expect(project!.mappings).toBe("")
  })

  test("handles .esq with only mappings", () => {
    const esqPath = join(TMP, ".esq")
    writeFileSync(esqPath, "ES_HOST=MY_HOST\n")

    const project = loadEsqProject(TMP)
    expect(project).not.toBeNull()
    expect(project!.index).toBeUndefined()
    expect(project!.mappings).toBe("ES_HOST=MY_HOST")
  })

  test("ignores blank lines and comments", () => {
    const esqPath = join(TMP, ".esq")
    writeFileSync(esqPath, "\n# comment\n\nES_HOST=MY_HOST\n# another\n\n")

    const project = loadEsqProject(TMP)
    expect(project!.mappings).toBe("ES_HOST=MY_HOST")
  })
})
