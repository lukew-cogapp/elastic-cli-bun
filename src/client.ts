import { Client } from "@opensearch-project/opensearch"
import type { EsConfig } from "./config.ts"

export class EsClient {
  readonly client: Client

  constructor(config: EsConfig) {
    const opts: ConstructorParameters<typeof Client>[0] = {
      node: config.host,
      ssl: { rejectUnauthorized: false },
    }

    if (config.apiKey) {
      opts.auth = { apiKey: config.apiKey } as never
    } else if (config.user && config.password) {
      opts.auth = { username: config.user, password: config.password }
    }

    this.client = new Client(opts)
  }

  async search(params: { index: string; body: Record<string, unknown> }) {
    const res = await this.client.search(params)
    return res.body
  }

  async count(params: { index: string; body?: Record<string, unknown> }) {
    const res = await this.client.count(params)
    return res.body
  }

  async getDoc(params: { index: string; id: string }) {
    const res = await this.client.get(params)
    return res.body
  }

  async getMapping(params: { index: string }) {
    const res = await this.client.indices.getMapping(params)
    return res.body
  }

  async catIndices() {
    const res = await this.client.cat.indices({ format: "json", s: "index" })
    return res.body
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

    const SAFE_POST_PATTERNS = [
      /_search$/, /_count$/, /_msearch$/, /_mget$/,
      /_field_caps$/, /_validate\/query$/, /_explain$/, /_terms_enum$/,
    ]

    if (upper === "POST" && !SAFE_POST_PATTERNS.some((p) => p.test(path))) {
      throw new Error(`Blocked: POST to ${path} is not a known read-only operation. esq is read-only.`)
    }

    const res = await this.client.transport.request({
      method: upper,
      path,
      body,
    })
    return res.body
  }
}
