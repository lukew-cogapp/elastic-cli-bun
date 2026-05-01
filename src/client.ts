import { Client, errors } from "@opensearch-project/opensearch"
import type { EsConfig } from "./config.ts"

/**
 * Format an OpenSearch client error into a human-readable message.
 */
function formatError(err: unknown, host: string): never {
  if (err instanceof errors.ResponseError) {
    const { statusCode, body, meta } = err
    const reason =
      body?.error?.reason ?? body?.error?.type ?? body?.error ?? null
    const index = meta?.meta?.request?.params?.index
    const lines = [`${statusCode} from ${host}`]
    if (index) lines.push(`Index: ${index}`)
    if (reason) lines.push(`Reason: ${reason}`)
    if (statusCode === 401) lines.push("Check ES_USER and ES_PASSWORD credentials.")
    if (statusCode === 403) lines.push("User lacks permissions for this operation.")
    if (statusCode === 404 && index) lines.push(`Index "${index}" may not exist.`)
    throw new Error(lines.join("\n"))
  }

  if (err instanceof errors.ConnectionError) {
    throw new Error(
      `Connection failed: ${host}\n${err.message}\nCheck that ES_HOST is correct and the cluster is reachable.`,
    )
  }

  if (err instanceof errors.TimeoutError) {
    throw new Error(`Request timed out: ${host}\n${err.message}`)
  }

  if (err instanceof errors.NoLivingConnectionsError) {
    throw new Error(
      `No living connections: ${host}\nThe cluster may be down or the URL may be wrong.`,
    )
  }

  throw err
}

export class EsClient {
  private readonly client: Client
  readonly host: string

  constructor(config: EsConfig) {
    this.host = config.host

    const opts: ConstructorParameters<typeof Client>[0] = {
      node: config.host,
      ssl: { rejectUnauthorized: false },
    }

    if (config.apiKey) {
      // OpenSearch client's auth.apiKey path doesn't emit the
      // `Authorization: ApiKey <key>` header that Elastic + Elastic
      // Serverless require — it base64-wraps it as a Basic credential.
      // Set the header explicitly so esq works against both OpenSearch
      // (which also accepts ApiKey-style auth) and Elastic Serverless.
      opts.headers = { Authorization: `ApiKey ${config.apiKey}` }
    } else if (config.user && config.password) {
      opts.auth = { username: config.user, password: config.password }
    }

    this.client = new Client(opts)
  }

  async search(params: { index: string; body: Record<string, unknown> }) {
    try {
      const res = await this.client.search(params)
      return res.body
    } catch (err) {
      formatError(err, this.host)
    }
  }

  async count(params: { index: string; body?: Record<string, unknown> }) {
    try {
      const res = await this.client.count(params)
      return res.body
    } catch (err) {
      formatError(err, this.host)
    }
  }

  async getDoc(params: { index: string; id: string }) {
    try {
      const res = await this.client.get(params)
      return res.body
    } catch (err) {
      formatError(err, this.host)
    }
  }

  async getMapping(params: { index: string }) {
    try {
      const res = await this.client.indices.getMapping(params)
      return res.body
    } catch (err) {
      formatError(err, this.host)
    }
  }

  async catIndices() {
    try {
      const res = await this.client.cat.indices({ format: "json", s: "index" })
      return res.body
    } catch (err) {
      formatError(err, this.host)
    }
  }

  /**
   * Raw request for endpoints not covered by typed methods.
   * Blocks write operations.
   */
  async raw(method: string, path: string, body?: unknown) {
    const upper = method.toUpperCase()
    if (upper !== "GET" && upper !== "POST") {
      throw new Error(`Blocked: ${upper} requests are not allowed. esq is read-only.`)
    }

    // Strip query string before checking path patterns
    const pathname = path.split("?")[0]

    // Block mutating GET endpoints
    const MUTATING_GET_PATTERNS = [
      /\/_refresh(\/|$)/, /\/_flush(\/|$)/, /\/_forcemerge(\/|$)/,
      /\/_cache\/clear(\/|$)/, /\/_close(\/|$)/, /\/_open(\/|$)/,
    ]

    if (upper === "GET" && MUTATING_GET_PATTERNS.some((p) => p.test(pathname))) {
      throw new Error(`Blocked: GET ${path} is a mutating operation. esq is read-only.`)
    }

    // Patterns match against path segments, not arbitrary suffixes.
    // Each pattern requires the API keyword to appear after a / boundary.
    const SAFE_POST_PATTERNS = [
      /\/_search$/, /\/_count$/, /\/_msearch$/, /\/_mget$/,
      /\/_field_caps$/, /\/_validate\/query$/, /\/_explain$/, /\/_terms_enum$/,
    ]

    if (upper === "POST" && !SAFE_POST_PATTERNS.some((p) => p.test(pathname))) {
      throw new Error(`Blocked: POST to ${path} is not a known read-only operation. esq is read-only.`)
    }

    try {
      const res = await this.client.transport.request({
        method: upper,
        path,
        body,
      })
      return res.body
    } catch (err) {
      formatError(err, this.host)
    }
  }
}
